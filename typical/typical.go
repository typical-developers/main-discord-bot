package typical

import (
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/disgoorg/disgo/bot"
	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/events"
	"github.com/disgoorg/disgo/handler"
	"github.com/disgoorg/snowflake/v2"
	"github.com/typical-developers/main-discord-bot/cmd/bot/commands"
	"github.com/typical-developers/main-discord-bot/cmd/bot/components"
	"github.com/typical-developers/main-discord-bot/cmd/bot/handlers"
	"github.com/typical-developers/main-discord-bot/cmd/bot/listeners"
	"github.com/typical-developers/main-discord-bot/internal/config"
	"github.com/typical-developers/main-discord-bot/internal/database"
	"github.com/typical-developers/main-discord-bot/internal/disgox"
)

const genericErrorMessage = "Something went wrong, this has been forwarded internally to our developers. Please try again later."

type TypicalBot struct {
	client *bot.Client

	globalCommands []discord.ApplicationCommandCreate
	guildCommands  map[snowflake.ID][]discord.ApplicationCommandCreate
}

// New registers every listener and command on the client and router.
// Commands are not sent to Discord until SyncCommands is called.
func New(c *bot.Client, r *handler.Mux, cfg *config.Config, db *database.Database) (*TypicalBot, error) {
	t := &TypicalBot{
		client:        c,
		guildCommands: make(map[snowflake.ID][]discord.ApplicationCommandCreate),
	}

	// middleware has to be added before any routes are registered.
	r.Use(handlers.Recover)
	r.Error(t.handleInteractionEventError)

	listeners.Register(c, r, cfg, db)
	components.Register(r, cfg, db)

	for _, command := range commands.GlobalCommands(cfg, db) {
		if err := t.registerCommand(r, command, nil); err != nil {
			return nil, err
		}
	}

	for guildID, guildCommands := range commands.GuildCommands(cfg, db) {
		for _, command := range guildCommands {
			if err := t.registerCommand(r, command, &guildID); err != nil {
				return nil, err
			}
		}
	}

	// SyncCommands only overwrites the guilds that have commands, so every other guild is
	// checked for leftover commands once the bot sees it.
	c.AddEventListeners(&events.ListenerAdapter{
		// fires for every guild the bot is already in when it connects.
		OnGuildReady: func(e *events.GuildReady) { t.clearStaleGuildCommands(e.GuildID) },
		OnGuildJoin:  func(e *events.GuildJoin) { t.clearStaleGuildCommands(e.GuildID) },
	})

	return t, nil
}

// registerCommand routes the command's handlers under "/<command name>" and queues
// its definition for syncing. A nil guildID means the command is global.
func (t *TypicalBot) registerCommand(r *handler.Mux, command commands.Command, guildID *snowflake.ID) error {
	create := command.Create()

	name := create.CommandName()
	if strings.Contains(name, "/") {
		return fmt.Errorf("command %q: names cannot contain '/' because the name is used as its route", name)
	}

	r.Route("/"+name, command.Register)

	switch {
	case guildID == nil:
		t.globalCommands = append(t.globalCommands, create)
	default:
		t.guildCommands[*guildID] = append(t.guildCommands[*guildID], create)
	}

	return nil
}

// SyncCommands overwrites Discord's commands with the registered ones.
func (t *TypicalBot) SyncCommands() error {
	if err := handler.SyncCommands(t.client, t.globalCommands, nil); err != nil {
		return fmt.Errorf("sync global commands: %w", err)
	}
	slog.Info("synced global commands", slog.Int("count", len(t.globalCommands)))

	for guildID, guildCommands := range t.guildCommands {
		if err := handler.SyncCommands(t.client, guildCommands, []snowflake.ID{guildID}); err != nil {
			return fmt.Errorf("sync commands for guild %s: %w", guildID, err)
		}
		slog.Info("synced guild commands", slog.String("guild_id", guildID.String()), slog.Int("count", len(guildCommands)))
	}

	return nil
}

// clearStaleGuildCommands removes the commands left in a guild that has no guild commands anymore,
// such as ones registered while the bot used a development guild or ones from a guild that was
// removed from commands.GuildCommands. Guilds with guild commands are handled by SyncCommands.
func (t *TypicalBot) clearStaleGuildCommands(guildID snowflake.ID) {
	if _, ok := t.guildCommands[guildID]; ok {
		return
	}

	log := slog.With(slog.String("guild_id", guildID.String()))

	existing, err := t.client.Rest.GetGuildCommands(t.client.ApplicationID, guildID, false)
	if err != nil {
		log.Error("failed to get guild commands", slog.Any("err", err))
		return
	}

	if len(existing) == 0 {
		return
	}

	// an empty (not nil) slice, so it's sent as [] and removes every command.
	if _, err := t.client.Rest.SetGuildCommands(t.client.ApplicationID, guildID, []discord.ApplicationCommandCreate{}); err != nil {
		log.Error("failed to remove stale guild commands", slog.Any("err", err))
		return
	}

	log.Info("removed stale guild commands", slog.Int("count", len(existing)))
}

// handleInteractionEventError replies with the message of a disgox.UserError, or logs
// the error and replies with a generic message for anything else.
func (t *TypicalBot) handleInteractionEventError(e *handler.InteractionEvent, err error) {
	message := genericErrorMessage

	if userErr, ok := errors.AsType[*disgox.UserError](err); ok {
		message = userErr.Message
	} else {
		slog.Error("interaction handler failed",
			slog.String("interaction", disgox.InteractionName(e)),
			slog.String("interaction_id", e.Interaction.ID().String()),
			slog.String("user_id", e.Interaction.User().ID.String()),
			slog.Any("err", err),
		)
	}

	// autocomplete interactions cannot receive messages.
	if _, ok := e.Interaction.(discord.AutocompleteInteraction); ok {
		return
	}

	if err := disgox.ReplyEphemeral(e, message); err != nil {
		slog.Error("failed to send interaction error response", slog.Any("err", err))
	}
}
