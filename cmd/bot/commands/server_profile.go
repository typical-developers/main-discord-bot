package commands

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"image"
	"image/color"
	"sync"

	"github.com/disgoorg/disgo/bot"
	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/handler"
	"github.com/disgoorg/snowflake/v2"
	"github.com/typical-developers/main-discord-bot/cmd/bot/handlers"
	"github.com/typical-developers/main-discord-bot/internal/database"
	"github.com/typical-developers/main-discord-bot/internal/disgox"
	"github.com/typical-developers/main-discord-bot/internal/emojis"
	"github.com/typical-developers/main-discord-bot/internal/ptr"
	"github.com/typical-developers/main-discord-bot/internal/render"
)

// profileCards is shared by /server-profile and the "Get User's Profile" context menu.
type profileCards struct {
	db *database.Database
	// avatars and role icons; each card has at most two.
	images *render.ImageCache
}

func newProfileCards(db *database.Database) *profileCards {
	return &profileCards{db: db, images: render.NewImageCache(100)}
}

// profileImageOpts asks Discord for avatars as PNGs big enough for the profile card at 2x.
var profileImageOpts = []discord.CDNOpt{discord.WithSize(256), discord.WithFormat(discord.FileFormatPNG)}

// send replies to a command with a member's profile card.
func (p *profileCards) send(e *handler.CommandEvent, memberID snowflake.ID) error {
	member, err := disgox.GetMember(e.Client(), *e.GuildID(), memberID)
	if err != nil {
		return disgox.WrapUserError(err, "Unable to fetch the member's details.")
	}

	if err := e.DeferCreateMessage(false); err != nil {
		return err
	}

	update, err := p.render(e.Ctx, e.Client(), *e.GuildID(), member, e.User().ID)
	if err != nil {
		return err
	}

	_, err = e.UpdateInteractionResponse(update)
	return err
}

// refresh handles the refresh button under a profile card. Only the member who ran the command
// can press it (see RequireOriginalInvoker), and it's only shown on their own card.
func (p *profileCards) refresh(_ discord.ButtonInteractionData, e *handler.ComponentEvent) error {
	if err := e.DeferUpdateMessage(); err != nil {
		return err
	}

	member, err := disgox.GetMember(e.Client(), *e.GuildID(), e.User().ID)
	if err != nil {
		return err
	}

	update, err := p.render(e.Ctx, e.Client(), *e.GuildID(), member, e.User().ID)
	if err != nil {
		return err
	}

	_, err = e.UpdateInteractionResponse(update)
	return err
}

// render builds a member's profile card message. invokerID is who ran the command; the refresh
// button is only added when the card is their own.
func (p *profileCards) render(ctx context.Context, client *bot.Client, guildID snowflake.ID, member discord.Member, invokerID snowflake.ID) (discord.MessageUpdate, error) {
	card, err := p.load(ctx, client, guildID, member)
	if err != nil {
		return discord.MessageUpdate{}, err
	}

	file, err := p.draw(ctx, card)
	if err != nil {
		return discord.MessageUpdate{}, err
	}

	components := []discord.LayoutComponent{}
	if invokerID == member.User.ID {
		components = append(components, p.refreshRow())
	}

	return discord.MessageUpdate{
		Files: []*discord.File{file},
		// drops the previous card when the message is updated.
		Attachments: &[]discord.AttachmentUpdate{},
		Embeds:      &[]discord.Embed{},
		Components:  &components,
	}, nil
}

func (p *profileCards) refreshRow() discord.ActionRowComponent {
	return discord.NewActionRow(
		discord.NewSecondaryButton("", "/server-profile/refresh").
			WithEmoji(emojis.Component(emojis.EmojiRefresh)),
	)
}

type serverProfileCommand struct {
	cards *profileCards
}

func newServerProfileCommand(cards *profileCards) *serverProfileCommand {
	return &serverProfileCommand{cards}
}

func (c *serverProfileCommand) Create() discord.ApplicationCommandCreate {
	return discord.SlashCommandCreate{
		Name:        "server-profile",
		Description: "Get information on a server member!",
		Contexts:    guildOnly,
		Options: []discord.ApplicationCommandOption{
			discord.ApplicationCommandOptionUser{
				Name:        "user",
				Description: "The member you'd like to see the profile of. Defaults to you.",
			},
		},
	}
}

func (c *serverProfileCommand) Register(r handler.Router) {
	r.Use(handlers.GuildOnly)
	r.SlashCommand("/", c.profile)
	r.Group(func(r handler.Router) {
		r.Use(handlers.RequireOriginalInvoker)
		r.ButtonComponent("/refresh", c.cards.refresh)
	})
}

func (c *serverProfileCommand) profile(data discord.SlashCommandInteractionData, e *handler.CommandEvent) error {
	memberID := e.User().ID
	if user, ok := data.OptUser("user"); ok {
		memberID = user.ID
	}

	return c.cards.send(e, memberID)
}

type userProfileMenuCommand struct {
	cards *profileCards
}

func newUserProfileMenuCommand(cards *profileCards) *userProfileMenuCommand {
	return &userProfileMenuCommand{cards}
}

func (c *userProfileMenuCommand) Create() discord.ApplicationCommandCreate {
	return discord.UserCommandCreate{
		Name:     "Get User's Profile",
		Contexts: guildOnly,
	}
}

func (c *userProfileMenuCommand) Register(r handler.Router) {
	r.Use(handlers.GuildOnly)
	r.UserCommand("/", c.profile)
}

func (c *userProfileMenuCommand) profile(data discord.UserCommandInteractionData, e *handler.CommandEvent) error {
	return c.cards.send(e, data.TargetUser().ID)
}

type profileCard struct {
	DisplayName string
	Username    string
	AvatarURL   string

	Points      int32
	AllTimeRank int64
	// 0 when the member has no points on that leaderboard.
	DailyRank   int32
	WeeklyRank  int32
	MonthlyRank int32

	// nil when the member hasn't earned an activity role yet.
	CurrentRole *profileCardRole
	// nil when there's no higher activity role to earn.
	NextRole *profileCardProgress
}

type profileCardRole struct {
	Name string
	// the role's colour, or its gradient's colours. Empty when the role has no colour.
	Colors []int
	// empty when the role has no icon.
	IconURL        string
	RequiredPoints int32
}

// profileCardProgress is the progress from the current activity role to the next one.
type profileCardProgress struct {
	Current  int32
	Required int32
}

// load gathers everything shown on a member's chat activity profile card.
func (p *profileCards) load(ctx context.Context, client *bot.Client, guildID snowflake.ID, member discord.Member) (profileCard, error) {
	settings, err := p.db.Guilds.GetActivitySettings(ctx, guildID, database.ActivityTypeChat)
	if err != nil {
		return profileCard{}, err
	}

	if !settings.IsEnabled {
		return profileCard{}, disgox.UserErrorf("Chat activity tracking is not enabled for this server.")
	}

	profile, err := p.db.Members.GetProfile(ctx, guildID, member.User.ID)
	if err != nil {
		if errors.Is(err, database.ErrMemberProfileNotFound) {
			return profileCard{}, disgox.WrapUserError(err, fmt.Sprintf("<@%s> does not have a profile yet.", member.User.ID))
		}

		return profileCard{}, err
	}

	roleInfo, err := p.db.Members.GetActivityRoleInfo(ctx, guildID, database.ActivityTypeChat, profile.ChatActivity)
	if err != nil {
		return profileCard{}, err
	}

	rankings, err := p.db.Leaderboards.GetMemberRankings(ctx, guildID, member.User.ID, database.ActivityTypeChat)
	if err != nil {
		return profileCard{}, err
	}

	// the points, all time rank and activity roles are added up across every linked server.
	// The daily, weekly and monthly ranks are only for this server.
	card := profileCard{
		DisplayName: member.EffectiveName(),
		Username:    member.User.Username,
		AvatarURL:   member.EffectiveAvatarURL(profileImageOpts...),
		Points:      profile.ChatActivity,
		AllTimeRank: profile.ChatActivityRank,
		DailyRank:   rankings.DailyLeaderboardRank,
		WeeklyRank:  rankings.WeeklyLeaderboardRank,
		MonthlyRank: rankings.MonthlyLeaderboardRank,
	}

	if roleInfo.CurrentRoleID != nil {
		card.CurrentRole = &profileCardRole{
			Name:           disgox.RoleName(client, guildID, *roleInfo.CurrentRoleID),
			RequiredPoints: ptr.Value(roleInfo.CurrentRoleRequiredPoints),
		}

		if role, ok := client.Caches.Role(guildID, *roleInfo.CurrentRoleID); ok {
			card.CurrentRole.Colors = roleColors(role)
			if icon := role.IconURL(discord.WithSize(64), discord.WithFormat(discord.FileFormatPNG)); icon != nil {
				card.CurrentRole.IconURL = *icon
			}
		}
	}

	if roleInfo.NextRoleID != nil {
		// progress is counted from the current role, or from 0 when there isn't one.
		base := ptr.Value(roleInfo.CurrentRoleRequiredPoints)
		card.NextRole = &profileCardProgress{
			Current:  profile.ChatActivity - base,
			Required: ptr.Value(roleInfo.NextRoleRequiredPoints) - base,
		}
	}

	return card, nil
}

// roleColors returns a role's colour, or the colours of its gradient from left to right
// (holographic roles have three). It's empty when the role has no colour.
func roleColors(role discord.Role) []int {
	primary := role.RoleColors.PrimaryColor
	if primary == 0 {
		primary = role.Color
	}
	if primary == 0 {
		return nil
	}

	colors := []int{primary}
	for _, c := range []*int{role.RoleColors.SecondaryColor, role.RoleColors.TertiaryColor} {
		if c != nil {
			colors = append(colors, *c)
		}
	}
	return colors
}

// cardColors converts Discord colours (0xRRGGBB) for the renderer.
func cardColors(colors []int) []color.Color {
	out := make([]color.Color, len(colors))
	for i, c := range colors {
		out[i] = color.RGBA{uint8(c >> 16), uint8(c >> 8), uint8(c), 255}
	}
	return out
}

// draw draws a profile card as a PNG attachment.
func (p *profileCards) draw(ctx context.Context, card profileCard) (*discord.File, error) {
	fonts, err := render.DefaultFonts()
	if err != nil {
		return nil, err
	}

	// the images are fetched together.
	var avatar, roleIcon image.Image
	var wg sync.WaitGroup
	wg.Go(func() { avatar = p.images.Fetch(ctx, card.AvatarURL) })
	if card.CurrentRole != nil {
		wg.Go(func() { roleIcon = p.images.Fetch(ctx, card.CurrentRole.IconURL) })
	}
	wg.Wait()

	r := render.ProfileCard{
		Avatar:      avatar,
		DisplayName: card.DisplayName,
		Username:    card.Username,
		Chat: render.ActivityStats{
			Points:      int(card.Points),
			AllTimeRank: int(card.AllTimeRank),
			DailyRank:   int(card.DailyRank),
			WeeklyRank:  int(card.WeeklyRank),
			MonthlyRank: int(card.MonthlyRank),
		},
	}

	if card.CurrentRole != nil {
		r.ChatRole = &render.ProfileRole{Name: card.CurrentRole.Name, Colors: cardColors(card.CurrentRole.Colors), Icon: roleIcon}
		// the chat panel is themed on the member's current activity role.
		r.ChatTheme = r.ChatRole.Colors
	}

	if card.NextRole != nil {
		r.Chat.Progress = &render.Progress{Current: int(card.NextRole.Current), Required: int(card.NextRole.Required)}
	}

	b, err := render.PNG(r, fonts, render.Scale)
	if err != nil {
		return nil, err
	}

	return discord.NewFile("profile-card.png", "", bytes.NewReader(b)), nil
}
