package listeners

import (
	"context"
	"log/slog"

	"github.com/disgoorg/disgo/events"
	"github.com/disgoorg/snowflake/v2"
	"github.com/typical-developers/main-discord-bot/internal/database"
)

// guildRegistrar makes sure every guild the bot is in is registered in the database,
// so the rest of the bot can assume a guild's settings exist.
type guildRegistrar struct {
	db *database.Database
}

func newGuildRegistrar(db *database.Database) *events.ListenerAdapter {
	g := &guildRegistrar{db}

	return &events.ListenerAdapter{
		// fires for every guild the bot is already in when it connects.
		OnGuildReady: func(e *events.GuildReady) { g.register(e.GuildID) },
		OnGuildJoin:  func(e *events.GuildJoin) { g.register(e.GuildID) },
	}
}

func (g *guildRegistrar) register(guildID snowflake.ID) {
	ctx, cancel := context.WithTimeout(context.Background(), listenerTimeout)
	defer cancel()

	if err := g.db.Guilds.EnsureRegistered(ctx, guildID); err != nil {
		slog.Error("failed to register guild",
			slog.String("guild_id", guildID.String()),
			slog.Any("err", err),
		)
	}
}
