package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"slices"
	"syscall"
	"time"

	"github.com/disgoorg/disgo"
	"github.com/disgoorg/disgo/bot"
	"github.com/disgoorg/disgo/cache"
	"github.com/disgoorg/disgo/gateway"
	"github.com/disgoorg/disgo/handler"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
	"github.com/typical-developers/main-discord-bot/cmd/bot/tasks"
	"github.com/typical-developers/main-discord-bot/internal/config"
	"github.com/typical-developers/main-discord-bot/internal/database"
	"github.com/typical-developers/main-discord-bot/internal/emojis"
	disgoredis "github.com/typical-developers/main-discord-bot/pkg/disgo-redis"
	"github.com/typical-developers/main-discord-bot/typical"
)

const (
	shutdownTimeout = time.Second * 10

	cacheFlags = cache.FlagGuilds | cache.FlagChannels | cache.FlagRoles | cache.FlagVoiceStates | cache.FlagMembers
)

func main() {
	if err := run(); err != nil {
		slog.Error("bot exited with an error", slog.Any("err", err))
		os.Exit(1)
	}
}

func run() error {
	shadowed := loadDotEnv()

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: cfg.LogLevel})))

	for _, key := range shadowed {
		slog.Warn("ignoring .env value because the variable is already set in the environment", slog.String("key", key))
	}

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
				gateway.IntentGuildMessages,
				gateway.IntentGuildVoiceStates,
				// privileged: needed to read message links and GIF links in messages.
				gateway.IntentMessageContent,
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

	// the application ID comes from the token, so this shows which bot is logging in.
	slog.Info("logging in", slog.String("application_id", client.ApplicationID.String()))

	// buttons look their emojis up by name, so they're loaded before anything can be sent.
	if err := emojis.Load(client.Rest, client.ApplicationID); err != nil {
		return fmt.Errorf("load emojis: %w", err)
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

	tasks.Start(ctx, client, db)

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

// loadDotEnv loads .env into the environment. A missing .env is fine, the environment may
// already be populated (e.g. docker).
//
// Variables that are already set are not overridden, so a stale value in the shell, the
// OS environment or an IDE run configuration would silently win. The keys of any .env
// values skipped that way are returned so they can be logged.
func loadDotEnv() []string {
	values, err := godotenv.Read()
	if err != nil {
		return nil
	}

	var shadowed []string
	for key, value := range values {
		if current, ok := os.LookupEnv(key); ok && current != value {
			shadowed = append(shadowed, key)
		}
	}
	slices.Sort(shadowed)

	_ = godotenv.Load()
	return shadowed
}
