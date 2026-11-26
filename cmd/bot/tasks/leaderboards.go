package tasks

import (
	"context"
	"log/slog"

	"github.com/typical-developers/main-discord-bot/internal/database"
)

// leaderboardReset archives and clears the weekly and monthly activity leaderboards
// once a new week or month has started.
type leaderboardReset struct {
	db *database.Database
}

func newLeaderboardReset(db *database.Database) *leaderboardReset {
	return &leaderboardReset{db}
}

func (l *leaderboardReset) run(ctx context.Context) {
	l.reset(ctx, "weekly", l.db.Leaderboards.ResetWeekly)
	l.reset(ctx, "monthly", l.db.Leaderboards.ResetMonthly)
}

func (l *leaderboardReset) reset(ctx context.Context, period string, reset func(context.Context) (database.LeaderboardResetResult, error)) {
	result, err := reset(ctx)
	if err != nil {
		slog.Error("failed to reset activity leaderboard", slog.String("period", period), slog.Any("err", err))
		return
	}

	if !result.Reset {
		return
	}

	slog.Info("reset activity leaderboard",
		slog.String("period", period),
		slog.Int64("row_total", result.RowTotal),
		slog.Int("last_reset", int(result.LastReset)),
		slog.Int("expected_reset", int(result.ExpectedReset)),
	)
}
