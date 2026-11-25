package listeners

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/disgoorg/disgo/events"
	"github.com/typical-developers/main-discord-bot/internal/database"
)

const guildRegistrarTimeout = time.Second * 10

// guildRegistrar registers a guild in the database when the bot joins it.
type guildRegistrar struct {
	db *database.Database
}

func newGuildRegistrar(db *database.Database) *events.ListenerAdapter {
	g := &guildRegistrar{db}

	return &events.ListenerAdapter{
		OnGuildJoin: g.guildJoin,
	}
}

func (g *guildRegistrar) guildJoin(e *events.GuildJoin) {
	// gateway events have no context, so each one gets its own deadline.
	ctx, cancel := context.WithTimeout(context.Background(), guildRegistrarTimeout)
	defer cancel()

	if _, err := g.db.Guilds.Register(ctx, e.Guild.ID); err != nil && !errors.Is(err, database.ErrGuildAlreadyRegistered) {
		slog.Error("failed to register guild",
			slog.String("guild_id", e.Guild.ID.String()),
			slog.Any("err", err),
		)
	}
}
