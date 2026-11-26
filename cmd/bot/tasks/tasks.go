// Package tasks runs background work on an interval for as long as the bot is running.
package tasks

import (
	"context"
	"time"

	"github.com/disgoorg/disgo/bot"
	"github.com/luckfire/goblox/legacy"
	"github.com/typical-developers/main-discord-bot/internal/database"
)

const (
	// resetting is a no-op until a new week or month starts, so this only bounds how late a reset can be.
	leaderboardResetInterval = time.Minute * 5
	statusInterval           = time.Second * 10
)

// Start runs every task in the background until ctx is cancelled.
// Each task runs once immediately, then on its interval.
func Start(ctx context.Context, client *bot.Client, db *database.Database) {
	roblox := legacy.NewClient()

	go every(ctx, leaderboardResetInterval, newLeaderboardReset(db).run)
	go every(ctx, statusInterval, newBotStatus(client, roblox).run)
}

// every calls fn immediately and then every interval until ctx is cancelled.
// Runs never overlap: a slow run delays the next one.
func every(ctx context.Context, interval time.Duration, fn func(ctx context.Context)) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		fn(ctx)

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
