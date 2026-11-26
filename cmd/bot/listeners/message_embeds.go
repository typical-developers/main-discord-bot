package listeners

import (
	"context"
	"fmt"
	"log/slog"
	"regexp"
	"slices"

	"github.com/disgoorg/disgo/bot"
	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/events"
	"github.com/disgoorg/snowflake/v2"
	"github.com/typical-developers/main-discord-bot/internal/database"
)

// messageLinkRegex matches links to Discord messages: guild, channel and message IDs.
var messageLinkRegex = regexp.MustCompile(`https?://(?:(?:ptb|canary)\.)?discord(?:app)?\.com/channels/(\d{17,20})/(\d{17,20})/(\d{17,20})`)

// defaultEmbedColor is used when the author has no profile accent color.
const defaultEmbedColor = 0xFFFFFF

type messageLink struct {
	GuildID   snowflake.ID
	ChannelID snowflake.ID
	MessageID snowflake.ID
}

// messageEmbeds replies to messages containing message links with an embed of the linked message,
// as long as the author can see it.
type messageEmbeds struct {
	db *database.Database
}

func newMessageEmbeds(db *database.Database) *events.ListenerAdapter {
	m := &messageEmbeds{db}

	return &events.ListenerAdapter{
		OnGuildMessageCreate: m.guildMessageCreate,
	}
}

func (m *messageEmbeds) guildMessageCreate(e *events.GuildMessageCreate) {
	message := e.Message
	if message.Author.Bot || message.Member == nil || !messageLinkRegex.MatchString(message.Content) {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), listenerTimeout)
	defer cancel()

	settings, err := m.db.Guilds.GetMessageEmbedSettings(ctx, e.GuildID)
	if err != nil {
		slog.Error("failed to get message embed settings", slog.String("guild_id", e.GuildID.String()), slog.Any("err", err))
		return
	}

	if !settings.IsEnabled || slices.Contains(settings.DisabledChannels, e.ChannelID) {
		return
	}

	for _, roleID := range message.Member.RoleIDs {
		if slices.Contains(settings.IgnoredRoles, roleID) {
			return
		}
	}

	// the message member has no user attached, but permission checks need one.
	member := *message.Member
	member.User = message.Author
	member.GuildID = e.GuildID

	client := e.Client()

	// embed the first linked message the author can actually see.
	var (
		linked     *discord.Message
		linkedFrom messageLink
	)
	for _, link := range parseMessageLinks(client, message.Content, settings.IgnoredChannels) {
		if linked = fetchVisibleMessage(client, member, link); linked != nil {
			linkedFrom = link
			break
		}
	}

	if linked == nil {
		return
	}

	if _, err := client.Rest.CreateMessage(e.ChannelID, discord.MessageCreate{
		Embeds: linkedMessageEmbeds(client, linkedFrom.GuildID, *linked),
		Components: []discord.LayoutComponent{
			discord.NewActionRow(discord.NewLinkButton("Jump to Original", linked.JumpURL())),
		},
		MessageReference: &discord.MessageReference{MessageID: &message.ID},
		AllowedMentions:  &discord.AllowedMentions{RepliedUser: false},
	}); err != nil {
		slog.Error("failed to send message embed", slog.String("guild_id", e.GuildID.String()), slog.Any("err", err))
	}
}

// parseMessageLinks returns the unique message links in content, skipping ignored channels
// and guilds the bot isn't in.
func parseMessageLinks(client *bot.Client, content string, ignoredChannels []snowflake.ID) []messageLink {
	var links []messageLink

	for _, match := range messageLinkRegex.FindAllStringSubmatch(content, -1) {
		guildID, err1 := snowflake.Parse(match[1])
		channelID, err2 := snowflake.Parse(match[2])
		messageID, err3 := snowflake.Parse(match[3])
		if err1 != nil || err2 != nil || err3 != nil {
			continue
		}

		if slices.Contains(ignoredChannels, channelID) {
			continue
		}

		if slices.ContainsFunc(links, func(l messageLink) bool { return l.MessageID == messageID }) {
			continue
		}

		if _, ok := client.Caches.Guild(guildID); !ok {
			continue
		}

		links = append(links, messageLink{GuildID: guildID, ChannelID: channelID, MessageID: messageID})
	}

	return links
}

// fetchVisibleMessage fetches a linked message, or returns nil if the member can't see it
// or it has nothing to show.
func fetchVisibleMessage(client *bot.Client, member discord.Member, link messageLink) *discord.Message {
	channel, ok := client.Caches.Channel(link.ChannelID)
	if !ok || channel.GuildID() != link.GuildID {
		return nil
	}

	// links can point to other servers the bot is in, so check the author is a member there.
	if link.GuildID != member.GuildID {
		other, err := client.Rest.GetMember(link.GuildID, member.User.ID)
		if err != nil {
			return nil
		}
		member = *other
		member.GuildID = link.GuildID
	}

	// threads take their permissions from their parent channel.
	permissionChannel := channel
	if thread, ok := channel.(discord.GuildThread); ok {
		parent, ok := client.Caches.Channel(*thread.ParentID())
		if !ok {
			return nil
		}
		permissionChannel = parent
	}

	permissions := client.Caches.MemberPermissionsInChannel(permissionChannel, member)
	if !permissions.Has(discord.PermissionViewChannel, discord.PermissionReadMessageHistory) {
		return nil
	}

	message, err := client.Rest.GetMessage(link.ChannelID, link.MessageID)
	if err != nil {
		return nil
	}

	if message.Content == "" && len(message.Attachments) == 0 {
		return nil
	}

	return message
}

// linkedMessageEmbeds builds the embeds for a linked message. The first attachment is shown in
// the main embed, the rest are added as extra embeds that Discord shows as a gallery.
func linkedMessageEmbeds(client *bot.Client, guildID snowflake.ID, message discord.Message) []discord.Embed {
	author := message.Author

	// accent colors are only included when fetching the user directly.
	color := defaultEmbedColor
	if user, err := client.Rest.GetUser(author.ID); err == nil {
		author = *user
		if author.AccentColor != nil {
			color = *author.AccentColor
		}
	}

	embed := discord.NewEmbed().
		WithAuthorName(authorName(author)).
		WithAuthorIcon(author.EffectiveAvatarURL()).
		WithDescription(message.Content).
		WithColor(color).
		WithTimestamp(message.CreatedAt).
		WithFooterText(channelName(client, message.ChannelID))

	if guild, ok := client.Caches.Guild(guildID); ok {
		if icon := guild.IconURL(); icon != nil {
			embed = embed.WithFooterIcon(*icon)
		}
	}

	embeds := []discord.Embed{embed}
	for i, attachment := range message.Attachments {
		if i == 0 {
			embeds[0] = embeds[0].WithURL(message.JumpURL()).WithImage(attachment.URL)
			continue
		}

		embeds = append(embeds, discord.NewEmbed().WithURL(message.JumpURL()).WithImage(attachment.URL))
	}

	return embeds
}

// authorName formats the most appropriate name for a message author.
func authorName(user discord.User) string {
	if user.Discriminator != "0" {
		return user.Tag()
	}

	if user.GlobalName != nil {
		return fmt.Sprintf("%s (@%s)", *user.GlobalName, user.Username)
	}

	return "@" + user.Username
}

// channelName formats a channel as "Server - #channel".
func channelName(client *bot.Client, channelID snowflake.ID) string {
	channel, ok := client.Caches.Channel(channelID)
	if !ok {
		return channelID.String()
	}

	guildName := channel.GuildID().String()
	if guild, ok := client.Caches.Guild(channel.GuildID()); ok {
		guildName = guild.Name
	}

	switch channel.Type() {
	case discord.ChannelTypeGuildText, discord.ChannelTypeGuildNews, discord.ChannelTypeGuildVoice, discord.ChannelTypeGuildStageVoice:
		return fmt.Sprintf("%s - #%s", guildName, channel.Name())
	default:
		return fmt.Sprintf("%s - %s", guildName, channel.Name())
	}
}
