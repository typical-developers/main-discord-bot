// Workers runs scheduled background jobs against the database, separately from the bot.
package main

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/joho/godotenv"
	"github.com/robfig/cron/v3"
	"github.com/typical-developers/main-discord-bot/internal/config"
	"github.com/typical-developers/main-discord-bot/internal/database"
	"github.com/typical-developers/main-discord-bot/internal/jobs"
)

func initDb(cfg *config.Config) *database.Database {
	// workers only run a few queries at a time, so keep the pool small.
	connString := cfg.DatabaseURL() + "&pool_min_conns=0&pool_max_conns=2&application_name=main_discord_bot_workers"

	pool, err := database.NewPool(context.TODO(), connString)
	if err != nil {
		slog.Error("failed to connect to database", slog.Any("err", err))
		os.Exit(1)
	}

	return database.New(pool)
}

func main() {
	// a missing .env is fine, the environment may already be populated (e.g. docker).
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", slog.Any("err", err))
		os.Exit(1)
	}

	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: cfg.LogLevel})))

	db := initDb(cfg)
	handler := jobs.NewHandler(jobs.WithCron(
		cron.New(cron.WithLocation(time.UTC)),
	))

	handler.AddJobs([]jobs.Job{
		{
			Spec: "*/5 * * * *",
			Config: jobs.Config{
				Enabled: true,
			},
			JobFunc: func(ctx context.Context) {
				if err := db.Leaderboards.Refresh(ctx); err != nil {
					slog.Error("activity leaderboards refresh failed", slog.Any("err", err))
				}
			},
		},
	}...)

	slog.Info("workers are running")
	handler.Start()
}
