package commands

import (
	"context"
	"fmt"
	"strconv"

	"github.com/disgoorg/disgo/bot"
	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/handler"
	"github.com/disgoorg/snowflake/v2"
	"github.com/typical-developers/main-discord-bot/cmd/bot/handlers"
	"github.com/typical-developers/main-discord-bot/internal/database"
	"github.com/typical-developers/main-discord-bot/internal/disgox"
	"github.com/typical-developers/main-discord-bot/internal/emojis"
)

type serverLeaderboardCommand struct {
	db *database.Database
}

func newServerLeaderboardCommand(db *database.Database) *serverLeaderboardCommand {
	return &serverLeaderboardCommand{db}
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
	card, err := loadLeaderboardCard(ctx, client, c.db, guildID, activityType, period, page)
	if err != nil {
		return discord.MessageUpdate{}, err
	}

	file, err := leaderboardCardFile(ctx, card)
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
