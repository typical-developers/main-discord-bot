package listeners

import (
	"context"
	"fmt"
	"log/slog"
	"regexp"
	"slices"
	"strings"

	"github.com/disgoorg/disgo/bot"
	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/events"
	"github.com/disgoorg/disgo/handler"
	"github.com/disgoorg/disgo/rest"
	"github.com/disgoorg/snowflake/v2"
	"github.com/typical-developers/main-discord-bot/cmd/bot/handlers"
	"github.com/typical-developers/main-discord-bot/internal/database"
	"github.com/typical-developers/main-discord-bot/internal/disgox"
)

// messageEmbeds replies to messages containing message links with an embed of the first linked
// message the author can see, and a menu to switch between them when there are several.
// Adapted from nagomi's message embeds listener.
type messageEmbeds struct {
	db *database.Database
}

func newMessageEmbeds(r handler.Router, db *database.Database) *events.ListenerAdapter {
	m := &messageEmbeds{db}

	r.Group(func(r handler.Router) {
		r.Use(handlers.GuildOnly)
		r.SelectMenuComponent(messageEmbedSelectID, m.selectMessage)
	})

	return &events.ListenerAdapter{
		OnGuildMessageCreate: m.guildMessageCreate,
	}
}

func (m *messageEmbeds) guildMessageCreate(e *events.GuildMessageCreate) {
	message := e.Message

	// most messages have no links, so skip them before touching the database.
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

	client := e.Client()
	if !settings.IsEnabled ||
		slices.Contains(settings.DisabledChannels, e.ChannelID) ||
		hasIgnoredRole(*message.Member, settings.IgnoredRoles) {
		return
	}

	// the message member has no user attached, but permission checks need one.
	author := *message.Member
	author.User = message.Author
	author.GuildID = e.GuildID

	var (
		embeds []discord.Embed
		links  []messageLink
	)
	for _, link := range parseMessageLinks(message.Content) {
		if len(links) == maxMessageLinkOptions {
			break
		}

		if link.GuildID == e.GuildID && isIgnoredChannel(client, settings.IgnoredChannels, link.ChannelID) {
			continue
		}

		linked, ok := resolveMessageLink(ctx, client, m.db, e.GuildID, link, author)
		if !ok {
			continue
		}

		if embeds == nil {
			embeds = linked.Embeds(client)
		}
		links = append(links, link)
	}

	if len(embeds) == 0 {
		return
	}

	var components []discord.LayoutComponent
	if len(links) > 1 {
		components = append(components, messageLinkMenu(links))
	}

	if _, err := client.Rest.CreateMessage(e.ChannelID, discord.MessageCreate{
		Embeds:           embeds,
		Components:       components,
		MessageReference: &discord.MessageReference{MessageID: &message.ID},
		AllowedMentions:  &discord.AllowedMentions{RepliedUser: false},
	}); err != nil {
		slog.Error("failed to send message embed", slog.String("guild_id", e.GuildID.String()), slog.Any("err", err))
	}
}

// selectMessage switches the embed to another of the linked messages.
func (m *messageEmbeds) selectMessage(data discord.SelectMenuInteractionData, e *handler.ComponentEvent) error {
	values, ok := data.(discord.StringSelectMenuInteractionData)
	if !ok || len(values.Values) == 0 {
		return nil
	}

	link, err := parseMessageLinkOption(values.Values[0])
	if err != nil {
		return err
	}

	guildID := *e.GuildID()
	settings, err := m.db.Guilds.GetMessageEmbedSettings(e.Ctx, guildID)
	if err != nil {
		return err
	}

	// the settings may have changed since the embed was sent.
	if !settings.IsEnabled {
		return disgox.UserErrorf("Message embeds have been disabled in this server.")
	}
	if link.GuildID == guildID && isIgnoredChannel(e.Client(), settings.IgnoredChannels, link.ChannelID) {
		return disgox.UserErrorf("Messages from that channel can no longer be embedded.")
	}

	resolved := e.Member()
	if resolved == nil {
		return nil
	}
	viewer := resolved.Member
	viewer.GuildID = guildID

	// whoever switches the message has to be able to see it themselves.
	linked, ok := resolveMessageLink(e.Ctx, e.Client(), m.db, guildID, link, viewer)
	if !ok {
		return disgox.UserErrorf("That message can't be embedded. You may not have access to it, or it was deleted.")
	}

	embeds := linked.Embeds(e.Client())
	return e.UpdateMessage(discord.MessageUpdate{Embeds: &embeds})
}

// messageEmbedSelectID is the custom ID of the menu for switching between linked messages.
const messageEmbedSelectID = "/message-embed"

const (
	// Discord allows 25 options in a select menu and 10 embeds in a message.
	maxMessageLinkOptions = 25
	maxMessageEmbeds      = 10
)

// messageLinkRegex matches links to Discord messages.
// https://sapphirejs.dev/docs/Guide/utilities/Discord_Utilities/UsefulRegexes/#message-link-regex
var messageLinkRegex = regexp.MustCompile(`(?:https://)?(?:ptb\.|canary\.)?discord(?:app)?\.com/channels/(\d{17,20})/(\d{17,20})/(\d{17,20})`)

// messageLink is a link to a Discord message.
type messageLink struct {
	GuildID   snowflake.ID
	ChannelID snowflake.ID
	MessageID snowflake.ID
}

// parseMessageLinks returns the message links in content, without duplicates.
func parseMessageLinks(content string) []messageLink {
	var links []messageLink

	for _, match := range messageLinkRegex.FindAllStringSubmatch(content, -1) {
		guildID, err1 := snowflake.Parse(match[1])
		channelID, err2 := snowflake.Parse(match[2])
		messageID, err3 := snowflake.Parse(match[3])
		if err1 != nil || err2 != nil || err3 != nil {
			continue
		}

		// the same message can be linked through different subdomains.
		if slices.ContainsFunc(links, func(l messageLink) bool { return l.MessageID == messageID }) {
			continue
		}

		links = append(links, messageLink{GuildID: guildID, ChannelID: channelID, MessageID: messageID})
	}

	return links
}

// option encodes the link as a select menu option value.
func (l messageLink) option() string {
	return fmt.Sprintf("%s_%s_%s", l.GuildID, l.ChannelID, l.MessageID)
}

// parseMessageLinkOption decodes a select menu option value made by messageLinkMenu.
func parseMessageLinkOption(value string) (messageLink, error) {
	parts := strings.SplitN(value, "_", 3)
	if len(parts) != 3 {
		return messageLink{}, fmt.Errorf("invalid message link option %q", value)
	}

	guildID, err := snowflake.Parse(parts[0])
	if err != nil {
		return messageLink{}, err
	}
	channelID, err := snowflake.Parse(parts[1])
	if err != nil {
		return messageLink{}, err
	}
	messageID, err := snowflake.Parse(parts[2])
	if err != nil {
		return messageLink{}, err
	}

	return messageLink{GuildID: guildID, ChannelID: channelID, MessageID: messageID}, nil
}

// messageLinkMenu builds the menu for switching between the linked messages.
func messageLinkMenu(links []messageLink) discord.ActionRowComponent {
	options := make([]discord.StringSelectMenuOption, 0, len(links))
	for i, link := range links {
		if i == maxMessageLinkOptions {
			break
		}
		options = append(options, discord.StringSelectMenuOption{
			Label: fmt.Sprintf("Message Link #%d", i+1),
			Value: link.option(),
		})
	}

	return discord.NewActionRow(discord.StringSelectMenuComponent{
		CustomID:    messageEmbedSelectID,
		Placeholder: "Select a Message",
		Options:     options,
	})
}

// isIgnoredChannel reports whether a channel, its parent channel (for threads) or its category is
// in ids.
func isIgnoredChannel(client *bot.Client, ids []snowflake.ID, channelID snowflake.ID) bool {
	for range 3 {
		if slices.Contains(ids, channelID) {
			return true
		}

		channel, ok := client.Caches.Channel(channelID)
		if !ok || channel.ParentID() == nil {
			return false
		}
		channelID = *channel.ParentID()
	}

	return false
}

// hasIgnoredRole reports whether the member has any of the roles in ids.
func hasIgnoredRole(member discord.Member, ids []snowflake.ID) bool {
	return slices.ContainsFunc(member.RoleIDs, func(id snowflake.ID) bool { return slices.Contains(ids, id) })
}

// linkedMessage is a linked message that can be embedded.
type linkedMessage struct {
	Guild   discord.CacheGuild
	Channel discord.GuildChannel
	Message discord.Message
}

// resolveMessageLink fetches a linked message for embedding in a message from sourceGuildID.
// It returns false if viewer can't see the message, the linked server doesn't allow its messages
// to be embedded, or the message has nothing to show.
func resolveMessageLink(ctx context.Context, client *bot.Client, db *database.Database, sourceGuildID snowflake.ID, link messageLink, viewer discord.Member) (linkedMessage, bool) {
	guild, ok := client.Caches.Guild(link.GuildID)
	if !ok {
		return linkedMessage{}, false
	}

	channel, ok := client.Caches.Channel(link.ChannelID)
	if !ok || channel.GuildID() != link.GuildID {
		return linkedMessage{}, false
	}

	// links can point to other servers the bot is in. Their own settings decide whether their
	// messages can be embedded, and the viewer has to be a member there.
	if link.GuildID != sourceGuildID {
		settings, err := db.Guilds.GetMessageEmbedSettings(ctx, link.GuildID)
		if err != nil || !settings.IsEnabled || isIgnoredChannel(client, settings.IgnoredChannels, link.ChannelID) {
			return linkedMessage{}, false
		}

		member, err := disgox.GetMember(client, link.GuildID, viewer.User.ID, rest.WithCtx(ctx))
		if err != nil {
			return linkedMessage{}, false
		}
		viewer = member
	}

	// threads take their permissions from their parent channel.
	permissionChannel := channel
	if thread, ok := channel.(discord.GuildThread); ok {
		if permissionChannel, ok = client.Caches.Channel(*thread.ParentID()); !ok {
			return linkedMessage{}, false
		}
	}

	if !client.Caches.MemberPermissionsInChannel(permissionChannel, viewer).Has(discord.PermissionViewChannel, discord.PermissionReadMessageHistory) {
		return linkedMessage{}, false
	}

	message, err := client.Rest.GetMessage(link.ChannelID, link.MessageID, rest.WithCtx(ctx))
	if err != nil {
		return linkedMessage{}, false
	}

	if message.Content == "" && !slices.ContainsFunc(message.Attachments, isImage) {
		return linkedMessage{}, false
	}

	return linkedMessage{Guild: guild, Channel: channel, Message: *message}, true
}

// Embeds builds the embeds for a linked message. The first image is shown in the main embed and
// the rest in image-only embeds, which Discord groups into a gallery because they share a URL.
func (l linkedMessage) Embeds(client *bot.Client) []discord.Embed {
	message := l.Message

	// the author's server profile, falling back to their user when they've left the server.
	name := message.Author.EffectiveName()
	iconURL := message.Author.EffectiveAvatarURL()
	if member, err := disgox.GetMember(client, l.Guild.ID, message.Author.ID); err == nil {
		name = member.EffectiveName()
		iconURL = member.EffectiveAvatarURL()
	}

	footer := l.Guild.Name + " - "
	if l.Channel.Type() == discord.ChannelTypeGuildText {
		footer += "#"
	}
	footer += l.Channel.Name()

	main := discord.Embed{
		URL: message.JumpURL(),
		Author: &discord.EmbedAuthor{
			Name:    fmt.Sprintf("%s (@%s)", name, message.Author.Username),
			IconURL: iconURL,
		},
		Description: message.Content,
		Timestamp:   &message.CreatedAt,
		Footer:      &discord.EmbedFooter{Text: footer},
	}
	if icon := l.Guild.IconURL(); icon != nil {
		main.Footer.IconURL = *icon
	}
	if message.Author.AccentColor != nil {
		main.Color = *message.Author.AccentColor
	}

	embeds := []discord.Embed{main}
	for _, attachment := range message.Attachments {
		if !isImage(attachment) {
			continue
		}

		image := &discord.EmbedResource{URL: attachment.URL}
		if attachment.Description != nil {
			image.Description = *attachment.Description
		}

		if embeds[0].Image == nil {
			embeds[0].Image = image
			continue
		}

		if len(embeds) == maxMessageEmbeds {
			break
		}
		embeds = append(embeds, discord.Embed{URL: message.JumpURL(), Image: image})
	}

	return embeds
}

func isImage(attachment discord.Attachment) bool {
	return attachment.ContentType != nil && strings.HasPrefix(*attachment.ContentType, "image/")
}
