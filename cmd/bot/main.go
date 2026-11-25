package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/disgoorg/disgo"
	"github.com/disgoorg/disgo/bot"
	"github.com/disgoorg/disgo/cache"
	"github.com/disgoorg/disgo/gateway"
	"github.com/disgoorg/disgo/handler"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
	"github.com/typical-developers/main-discord-bot/internal/config"
	"github.com/typical-developers/main-discord-bot/internal/database"
	disgoredis "github.com/typical-developers/main-discord-bot/pkg/disgo-redis"
	"github.com/typical-developers/main-discord-bot/typical"
)

const (
	shutdownTimeout = time.Second * 10
	cacheFlags      = cache.FlagGuilds | cache.FlagChannels | cache.FlagRoles
)

func main() {
	if err := run(); err != nil {
		slog.Error("bot exited with an error", slog.Any("err", err))
		os.Exit(1)
	}
}

func run() error {
	// a missing .env is fine, the environment may already be populated (e.g. docker).
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: cfg.LogLevel})))

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	db, closeDb, err := initDb(ctx, cfg)
	if err != nil {
		return err
	}
	defer closeDb()

	cacheOpt, closeCache, err := initCache(ctx, cfg)
	if err != nil {
		return err
	}
	defer closeCache()

	r := handler.New()

	client, err := disgo.New(cfg.Discord.Token,
		bot.WithLogger(slog.Default()),
		bot.WithGatewayConfigOpts(
			gateway.WithIntents(
				gateway.IntentGuilds,
			),
			gateway.WithAutoReconnect(true),
		),
		// handlers hit the database, so don't block the gateway while they run.
		bot.WithEventManagerConfigOpts(bot.WithAsyncEventsEnabled()),
		bot.WithEventListeners(r),
		cacheOpt,
	)
	if err != nil {
		return fmt.Errorf("create client: %w", err)
	}

	t, err := typical.New(client, r, cfg, db)
	if err != nil {
		return err
	}

	if err := t.SyncCommands(); err != nil {
		return err
	}

	if err := client.OpenGateway(ctx); err != nil {
		return fmt.Errorf("open gateway: %w", err)
	}
	defer func() {
		closeCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()
		client.Close(closeCtx)
	}()

	slog.Info("bot is running, press ctrl+c to stop")
	<-ctx.Done()
	slog.Info("shutting down")

	return nil
}

func initDb(ctx context.Context, cfg *config.Config) (*database.Database, func(), error) {
	pool, err := database.NewPool(ctx, cfg.DatabaseURL())
	if err != nil {
		return nil, nil, fmt.Errorf("connect to database: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, nil, fmt.Errorf("ping database: %w", err)
	}

	return database.New(pool), pool.Close, nil
}

// initCache uses Redis for disgo's cache when REDIS_URL is set, otherwise the in-memory cache.
func initCache(ctx context.Context, cfg *config.Config) (bot.ConfigOpt, func(), error) {
	if cfg.Redis.URL == "" {
		return bot.WithCacheConfigOpts(cache.WithCaches(cacheFlags)), func() {}, nil
	}

	opts, err := redis.ParseURL(cfg.Redis.URL)
	if err != nil {
		return nil, nil, fmt.Errorf("parse redis url: %w", err)
	}

	rdb := redis.NewClient(opts)
	if err := rdb.Ping(ctx).Err(); err != nil {
		_ = rdb.Close()
		return nil, nil, fmt.Errorf("ping redis: %w", err)
	}

	caches := disgoredis.New(rdb,
		disgoredis.WithCaches(cacheFlags),
		disgoredis.WithErrorHandler(func(err error) {
			slog.Warn("redis cache error", slog.Any("err", err))
		}),
	)

	closeFn := func() {
		caches.Close()
		_ = rdb.Close()
	}

	return bot.WithCaches(caches), closeFn, nil
}
