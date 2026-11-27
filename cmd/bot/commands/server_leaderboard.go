package commands

import (
	"bytes"
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/disgoorg/disgo/bot"
	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/handler"
	"github.com/disgoorg/disgo/rest"
	"github.com/disgoorg/snowflake/v2"
	"github.com/typical-developers/main-discord-bot/cmd/bot/handlers"
	"github.com/typical-developers/main-discord-bot/internal/database"
	"github.com/typical-developers/main-discord-bot/internal/disgox"
	"github.com/typical-developers/main-discord-bot/internal/emojis"
	"github.com/typical-developers/main-discord-bot/internal/render"
)

type serverLeaderboardCommand struct {
	db     *database.Database
	images *render.ImageCache
}

// guildIconOpts asks Discord for the server icon as a PNG big enough for the leaderboard at 2x.
var guildIconOpts = []discord.CDNOpt{discord.WithSize(256), discord.WithFormat(discord.FileFormatPNG)}

func newServerLeaderboardCommand(db *database.Database) *serverLeaderboardCommand {
	return &serverLeaderboardCommand{
		db: db,
		// pages are paginated and refreshed a lot, and each has a server icon and up to
		// leaderboardPageSize avatars.
		images: render.NewImageCache(150),
	}
}

// leaderboardFilters are the time periods a leaderboard can be filtered to. All time is the
// default when no filter is given.
var leaderboardFilters = []discord.ApplicationCommandOptionChoiceString{
	{Name: "All Time", Value: string(database.TimePeriodAllTime)},
	{Name: "This Year", Value: string(database.TimePeriodYearly)},
	{Name: "This Month", Value: string(database.TimePeriodMonthly)},
	{Name: "This Week", Value: string(database.TimePeriodWeekly)},
	{Name: "Today", Value: string(database.TimePeriodDaily)},
}

func (c *serverLeaderboardCommand) Create() discord.ApplicationCommandCreate {
	// every leaderboard is its own subcommand with the same options, e.g.
	// /server-leaderboard chat-activity filter:This Week page:2.
	options := []discord.ApplicationCommandOption{
		discord.ApplicationCommandOptionString{
			Name:        "filter",
			Description: "The time period to show. Defaults to all time.",
			Choices:     leaderboardFilters,
		},
		discord.ApplicationCommandOptionInt{
			Name:        "page",
			Description: "The page of the leaderboard to display.",
		},
	}

	return discord.SlashCommandCreate{
		Name:        "server-leaderboard",
		Description: "See the server's activity leaderboards!",
		Contexts:    guildOnly,
		Options: []discord.ApplicationCommandOption{
			discord.ApplicationCommandOptionSubCommand{
				Name:        "chat-activity",
				Description: "See the server's chat activity leaderboard.",
				Options:     options,
			},
		},
	}
}

func (c *serverLeaderboardCommand) Register(r handler.Router) {
	r.Use(handlers.GuildOnly)
	r.SlashCommand("/chat-activity", c.leaderboard(database.ActivityTypeChat))
	r.Group(func(r handler.Router) {
		r.Use(handlers.RequireOriginalInvoker)
		r.ButtonComponent("/page/{page}/{type}/{period}", c.paginate)
	})
}

// leaderboard returns the handler for an activity type's leaderboard subcommand.
func (c *serverLeaderboardCommand) leaderboard(activityType database.ActivityType) handler.SlashCommandHandler {
	return func(data discord.SlashCommandInteractionData, e *handler.CommandEvent) error {
		period := database.TimePeriodAllTime
		if filter, ok := data.OptString("filter"); ok {
			period = database.TimePeriod(filter)
		}
		if !period.Valid() {
			return disgox.UserErrorf("That leaderboard filter does not exist.")
		}

		page := 1
		if p, ok := data.OptInt("page"); ok {
			page = p
		}

		if err := e.DeferCreateMessage(false); err != nil {
			return err
		}

		update, err := c.render(e.Ctx, e.Client(), *e.GuildID(), activityType, period, page)
		if err != nil {
			return err
		}

		_, err = e.UpdateInteractionResponse(update)
		return err
	}
}

// paginate handles the page and refresh buttons under a leaderboard. Only the member who ran the
// command can press them (see RequireOriginalInvoker).
func (c *serverLeaderboardCommand) paginate(_ discord.ButtonInteractionData, e *handler.ComponentEvent) error {
	page, err := strconv.Atoi(e.Vars["page"])
	if err != nil {
		return fmt.Errorf("invalid leaderboard page %q: %w", e.Vars["page"], err)
	}

	activityType := database.ActivityType(e.Vars["type"])
	period := database.TimePeriod(e.Vars["period"])
	if !activityType.Valid() || !period.Valid() {
		return fmt.Errorf("invalid leaderboard %q/%q", activityType, period)
	}

	if err := e.DeferUpdateMessage(); err != nil {
		return err
	}

	update, err := c.render(e.Ctx, e.Client(), *e.GuildID(), activityType, period, page)
	if err != nil {
		return err
	}

	_, err = e.UpdateInteractionResponse(update)
	return err
}

// render builds a leaderboard page.
func (c *serverLeaderboardCommand) render(ctx context.Context, client *bot.Client, guildID snowflake.ID, activityType database.ActivityType, period database.TimePeriod, page int) (discord.MessageUpdate, error) {
	card, err := c.load(ctx, client, guildID, activityType, period, page)
	if err != nil {
		return discord.MessageUpdate{}, err
	}

	file, err := c.draw(ctx, card)
	if err != nil {
		return discord.MessageUpdate{}, err
	}

	return discord.MessageUpdate{
		Files: []*discord.File{file},
		// drops the previous card when the message is updated.
		Attachments: &[]discord.AttachmentUpdate{},
		Embeds:      &[]discord.Embed{},
		Components:  &[]discord.LayoutComponent{c.paginationRow(card)},
	}, nil
}

func (c *serverLeaderboardCommand) paginationRow(card leaderboardCard) discord.ActionRowComponent {
	current := int(card.Page.Page)
	total := int(card.Page.TotalPages)

	pageID := func(page int) string {
		return fmt.Sprintf("/server-leaderboard/page/%d/%s/%s", page, card.ActivityType, card.Period)
	}

	return discord.NewActionRow(
		discord.NewPrimaryButton("", pageID(current-1)).
			WithEmoji(emojis.Component(emojis.EmojiPreviousArrow)).
			WithDisabled(current <= 1),
		// a label only, it isn't routed.
		discord.NewSecondaryButton(fmt.Sprintf("%d / %d", current, total), "/server-leaderboard/page-label").
			AsDisabled(),
		discord.NewPrimaryButton("", pageID(current+1)).
			WithEmoji(emojis.Component(emojis.EmojiNextArrow)).
			WithDisabled(current >= total),
		// refreshing is just loading the current page again.
		discord.NewSecondaryButton("", pageID(current)).
			WithEmoji(emojis.Component(emojis.EmojiRefresh)),
	)
}

const (
	leaderboardPageSize = 15

	// how many leaderboard members are looked up at once.
	leaderboardLookups = 5
)

type leaderboardCard struct {
	GuildName string
	GuildIcon string

	ActivityType database.ActivityType
	Period       database.TimePeriod
	Page         database.LeaderboardPage
	// the members on the page, by ID.
	Members map[snowflake.ID]leaderboardMember
}

type leaderboardMember struct {
	Username  string
	AvatarURL string
}

// load gathers a page of a guild's activity leaderboard.
func (c *serverLeaderboardCommand) load(ctx context.Context, client *bot.Client, guildID snowflake.ID, activityType database.ActivityType, period database.TimePeriod, page int) (leaderboardCard, error) {
	settings, err := c.db.Guilds.GetActivitySettings(ctx, guildID, activityType)
	if err != nil {
		return leaderboardCard{}, err
	}

	if !settings.IsEnabled {
		return leaderboardCard{}, disgox.UserErrorf("%s activity tracking is not enabled for this server.", activityTypeName(activityType))
	}

	lb, err := c.db.Leaderboards.GetPage(ctx, guildID, activityType, period, int32(page), leaderboardPageSize)
	if err != nil {
		return leaderboardCard{}, err
	}

	if len(lb.Entries) == 0 {
		return leaderboardCard{}, disgox.UserErrorf("This leaderboard is not available yet, check back in a bit!")
	}

	card := leaderboardCard{
		ActivityType: activityType,
		Period:       period,
		Page:         lb,
		Members:      c.members(ctx, client, guildID, lb.Entries),
	}

	if guild, ok := client.Caches.Guild(guildID); ok {
		card.GuildName = guild.Name
		if icon := guild.IconURL(guildIconOpts...); icon != nil {
			card.GuildIcon = *icon
		}
	}

	return card, nil
}

// members looks up the username and avatar of everyone on a leaderboard page, from
// disgo's member cache where possible. Members who left the server are looked up as users, and
// anyone who can't be found (for example, deleted accounts) is shown as an unknown user with the
// default avatar for their ID.
func (c *serverLeaderboardCommand) members(ctx context.Context, client *bot.Client, guildID snowflake.ID, entries []database.LeaderboardEntry) map[snowflake.ID]leaderboardMember {
	avatarOpts := []discord.CDNOpt{discord.WithSize(64), discord.WithFormat(discord.FileFormatPNG)}

	var (
		mu      sync.Mutex
		members = make(map[snowflake.ID]leaderboardMember, len(entries))
		wg      sync.WaitGroup
		slots   = make(chan struct{}, leaderboardLookups)
	)

	for _, entry := range entries {
		if member, ok := client.Caches.Member(guildID, entry.MemberID); ok {
			members[entry.MemberID] = leaderboardMember{
				Username:  member.User.Username,
				AvatarURL: member.EffectiveAvatarURL(avatarOpts...),
			}
			continue
		}

		wg.Go(func() {
			slots <- struct{}{}
			defer func() { <-slots }()

			var member leaderboardMember
			if m, err := disgox.GetMember(client, guildID, entry.MemberID, rest.WithCtx(ctx)); err == nil {
				member = leaderboardMember{Username: m.User.Username, AvatarURL: m.EffectiveAvatarURL(avatarOpts...)}
			} else if user, err := client.Rest.GetUser(entry.MemberID, rest.WithCtx(ctx)); err == nil {
				member = leaderboardMember{Username: user.Username, AvatarURL: user.EffectiveAvatarURL(avatarOpts...)}
			} else {
				// a discriminator of 0 picks the default avatar from the ID, like Discord does.
				unknown := discord.User{ID: entry.MemberID, Discriminator: "0"}
				member = leaderboardMember{Username: "Unknown User", AvatarURL: unknown.DefaultAvatarURL(avatarOpts...)}
			}

			mu.Lock()
			members[entry.MemberID] = member
			mu.Unlock()
		})
	}

	wg.Wait()
	return members
}

// draw draws a leaderboard page as a PNG attachment.
func (c *serverLeaderboardCommand) draw(ctx context.Context, card leaderboardCard) (*discord.File, error) {
	fonts, err := render.DefaultFonts()
	if err != nil {
		return nil, err
	}

	periodText, resetsIn := leaderboardPeriod(card.Period, time.Now())
	r := render.LeaderboardCard{
		GuildName:  card.GuildName,
		Period:     periodText,
		ResetsIn:   resetsIn,
		ValueLabel: "Points",
		Rows:       make([]render.LeaderboardRow, len(card.Page.Entries)),

		Page:         int(card.Page.Page),
		TotalEntries: int(card.Page.TotalEntries),
		UpdatedAt:    card.Page.UpdatedAt.Format("01/02/2006 15:04 UTC"),
	}

	// the server icon and every member's avatar are fetched together.
	var wg sync.WaitGroup
	wg.Go(func() { r.GuildIcon = c.images.Fetch(ctx, card.GuildIcon) })

	for i, entry := range card.Page.Entries {
		member, ok := card.Members[entry.MemberID]
		if !ok {
			member.Username = "Unknown User"
		}

		r.Rows[i] = render.LeaderboardRow{
			Rank:  int(entry.Rank),
			Name:  "@" + member.Username,
			Value: int(entry.Points),
		}
		if member.AvatarURL != "" {
			wg.Go(func() { r.Rows[i].Avatar = c.images.Fetch(ctx, member.AvatarURL) })
		}
	}
	wg.Wait()

	b, err := render.PNG(r, fonts, render.Scale)
	if err != nil {
		return nil, err
	}

	return discord.NewFile("server-leaderboard.png", "", bytes.NewReader(b)), nil
}

// leaderboardPeriod describes a leaderboard's period for its card, and how long is left until it
// resets. Periods start at the beginning of each day, week (Monday), month and year in UTC,
// the same as the leaderboard queries.
func leaderboardPeriod(period database.TimePeriod, now time.Time) (text string, resetsIn string) {
	now = now.UTC()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)

	var label string
	var start, end time.Time
	switch period {
	case database.TimePeriodDaily:
		label = "Today"
		start = today
		end = start.AddDate(0, 0, 1)
	case database.TimePeriodWeekly:
		label = "This Week"
		start = today.AddDate(0, 0, -((int(today.Weekday()) + 6) % 7))
		end = start.AddDate(0, 0, 7)
	case database.TimePeriodMonthly:
		label = "This Month"
		start = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
		end = start.AddDate(0, 1, 0)
	case database.TimePeriodYearly:
		label = "This Year"
		start = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, time.UTC)
		end = start.AddDate(1, 0, 0)
	default:
		return "All Time", ""
	}

	const date = "01/02/2006"
	text = fmt.Sprintf("%s (%s - %s)", label, start.Format(date), end.AddDate(0, 0, -1).Format(date))

	return text, formatResetsIn(end.Sub(now))
}

// formatResetsIn formats the time left until a leaderboard resets, e.g. "07d 12h 10m". Units that
// are 0 are left out ("12h 10m", "07d 10m"), and anything under a minute is "<1m".
func formatResetsIn(left time.Duration) string {
	units := []struct {
		value  int
		suffix string
	}{
		{int(left / (24 * time.Hour)), "d"},
		{int(left/time.Hour) % 24, "h"},
		{int(left/time.Minute) % 60, "m"},
	}

	parts := make([]string, 0, len(units))
	for _, u := range units {
		if u.value > 0 {
			parts = append(parts, fmt.Sprintf("%02d%s", u.value, u.suffix))
		}
	}

	if len(parts) == 0 {
		return "<1m"
	}
	return strings.Join(parts, " ")
}

func activityTypeName(activityType database.ActivityType) string {
	switch activityType {
	case database.ActivityTypeVoice:
		return "Voice"
	default:
		return "Chat"
	}
}
