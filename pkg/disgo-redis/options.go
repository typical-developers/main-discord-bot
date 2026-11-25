package disgo_redis

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/disgoorg/disgo/cache"
	"github.com/disgoorg/disgo/discord"
	"github.com/redis/go-redis/v9"
)

const defaultNamespace = "disgo"

// ErrorHandler receives Redis and serialization errors. Disgo's cache
// interfaces do not return errors, so failed reads behave like cache misses and
// failed writes are ignored after invoking this handler. When WithTTL is used
// with New, the handler may also be called by the TTL renewal goroutine and
// must be safe for concurrent use.
type ErrorHandler func(error)

// OperationError describes an error raised by a Redis-backed cache operation.
type OperationError struct {
	Operation string
	Key       string
	Err       error
}

func (e *OperationError) Error() string {
	return fmt.Sprintf("redis cache %s %q: %v", e.Operation, e.Key, e.Err)
}

func (e *OperationError) Unwrap() error {
	return e.Err
}

// Option configures Redis-backed cache implementations. Storage-related
// options apply to both New and the individual primitive constructors.
type Option func(*config)

type config struct {
	namespace       string
	flags           cache.Flags
	contextProvider func() context.Context
	errorHandler    ErrorHandler
	ttl             time.Duration
	clearOnStart    bool

	guildPolicy                cache.Policy[discord.CacheGuild]
	channelPolicy              cache.Policy[discord.GuildChannel]
	stageInstancePolicy        cache.Policy[discord.StageInstance]
	guildScheduledEventPolicy  cache.Policy[discord.GuildScheduledEvent]
	guildSoundboardSoundPolicy cache.Policy[discord.SoundboardSound]
	rolePolicy                 cache.Policy[discord.Role]
	memberPolicy               cache.Policy[discord.Member]
	threadMemberPolicy         cache.Policy[discord.ThreadMember]
	presencePolicy             cache.Policy[discord.Presence]
	voiceStatePolicy           cache.Policy[discord.VoiceState]
	messagePolicy              cache.Policy[discord.Message]
	emojiPolicy                cache.Policy[discord.Emoji]
	stickerPolicy              cache.Policy[discord.Sticker]
}

func defaultConfig() config {
	return config{
		namespace:       defaultNamespace,
		contextProvider: context.Background,
		errorHandler:    func(error) {},

		guildPolicy:                cache.PolicyAll[discord.CacheGuild],
		channelPolicy:              cache.PolicyAll[discord.GuildChannel],
		stageInstancePolicy:        cache.PolicyAll[discord.StageInstance],
		guildScheduledEventPolicy:  cache.PolicyAll[discord.GuildScheduledEvent],
		guildSoundboardSoundPolicy: cache.PolicyAll[discord.SoundboardSound],
		rolePolicy:                 cache.PolicyAll[discord.Role],
		memberPolicy:               cache.PolicyAll[discord.Member],
		threadMemberPolicy:         cache.PolicyAll[discord.ThreadMember],
		presencePolicy:             cache.PolicyAll[discord.Presence],
		voiceStatePolicy:           cache.PolicyAll[discord.VoiceState],
		messagePolicy:              cache.PolicyAll[discord.Message],
		emojiPolicy:                cache.PolicyAll[discord.Emoji],
		stickerPolicy:              cache.PolicyAll[discord.Sticker],
	}
}

func applyOptions(options []Option) config {
	cfg := defaultConfig()
	for _, option := range options {
		if option != nil {
			option(&cfg)
		}
	}
	if cfg.contextProvider == nil {
		cfg.contextProvider = context.Background
	}
	if cfg.errorHandler == nil {
		cfg.errorHandler = func(error) {}
	}
	return cfg
}

func (c config) context() context.Context {
	ctx := c.contextProvider()
	if ctx == nil {
		return context.Background()
	}
	return ctx
}

func (c config) report(operation string, key string, err error) {
	if err != nil {
		c.errorHandler(&OperationError{Operation: operation, Key: key, Err: err})
	}
}

// hset queues an HSET of one field, attaching the configured TTL to that field
// when expiration is enabled.
func (c config) hset(ctx context.Context, cmd redis.Cmdable, key string, field string, data []byte) *redis.IntCmd {
	if c.ttl <= 0 {
		return cmd.HSet(ctx, key, field, data)
	}
	return cmd.HSetEXWithArgs(ctx, key, &redis.HSetEXOptions{
		ExpirationType: redis.HSetEXExpirationPX,
		ExpirationVal:  max(c.ttl.Milliseconds(), 1),
	}, field, string(data))
}

// expire queues a key-level TTL refresh when expiration is enabled.
func (c config) expire(ctx context.Context, cmd redis.Cmdable, key string) {
	if c.ttl > 0 {
		cmd.PExpire(ctx, key, c.ttl)
	}
}

func (c config) key(name string) string {
	if c.namespace == "" {
		return name
	}
	return strings.TrimRight(c.namespace, ":") + ":" + name
}

// WithNamespace sets the prefix used for every key created by New. The
// default is "disgo". An empty namespace uses the bare cache names.
func WithNamespace(namespace string) Option {
	return func(config *config) {
		config.namespace = namespace
	}
}

// WithCaches enables the supplied Disgo cache flags. It mirrors
// cache.WithCaches; no entity caches are enabled by default.
func WithCaches(flags ...cache.Flags) Option {
	return func(config *config) {
		config.flags = config.flags.Add(flags...)
	}
}

// WithTTL sets how long Redis cache entries and metadata keys are retained.
// Every hash-backed entity carries its own field-level TTL, set atomically when
// it is written (HSETEX, Redis 8.0 or newer), so entries expire independently
// of each other. Sets and the grouped-cache group indexes use key-level TTLs.
//
// New additionally renews every entry's TTL in the background until
// Caches.Close is called, so nothing expires while the bot is running; the TTL
// then bounds how long the cache outlives the process. Lower-level stores
// created with NewCache, NewGroupedCache, NewSet, or NewSelfUserCache apply the
// TTL when they write, but do not start a background renewal loop, so their
// entries expire TTL after their last write.
//
// A non-positive duration disables expiration, which is the default.
func WithTTL(ttl time.Duration) Option {
	return func(config *config) {
		config.ttl = ttl
	}
}

// WithClearOnStart removes cache keys already owned by the configured namespace
// before New constructs the caches. It is intended for single-process bots that
// prefer a fresh cache after every start. Do not use it when multiple active bot
// processes or shards share the same namespace.
func WithClearOnStart() Option {
	return func(config *config) {
		config.clearOnStart = true
	}
}

// WithContextProvider sets the source of contexts used for Redis operations.
// The provider is called once for each operation and may be called by the TTL
// renewal goroutine. A nil provider or a provider returning nil falls back
// to context.Background.
func WithContextProvider(provider func() context.Context) Option {
	return func(config *config) {
		config.contextProvider = provider
	}
}

// WithErrorHandler sets the callback for Redis and serialization errors. A nil
// handler discards errors.
func WithErrorHandler(handler ErrorHandler) Option {
	return func(config *config) {
		config.errorHandler = handler
	}
}

// WithGuildCachePolicy sets the policy applied before storing guilds.
func WithGuildCachePolicy(policy cache.Policy[discord.CacheGuild]) Option {
	return func(config *config) { config.guildPolicy = policy }
}

// WithChannelCachePolicy sets the policy applied before storing guild channels.
func WithChannelCachePolicy(policy cache.Policy[discord.GuildChannel]) Option {
	return func(config *config) { config.channelPolicy = policy }
}

// WithStageInstanceCachePolicy sets the policy applied before storing stage instances.
func WithStageInstanceCachePolicy(policy cache.Policy[discord.StageInstance]) Option {
	return func(config *config) { config.stageInstancePolicy = policy }
}

// WithGuildScheduledEventCachePolicy sets the policy applied before storing
// guild scheduled events.
func WithGuildScheduledEventCachePolicy(policy cache.Policy[discord.GuildScheduledEvent]) Option {
	return func(config *config) { config.guildScheduledEventPolicy = policy }
}

// WithGuildSoundboardSoundCachePolicy sets the policy applied before storing
// guild soundboard sounds.
func WithGuildSoundboardSoundCachePolicy(policy cache.Policy[discord.SoundboardSound]) Option {
	return func(config *config) { config.guildSoundboardSoundPolicy = policy }
}

// WithRoleCachePolicy sets the policy applied before storing roles.
func WithRoleCachePolicy(policy cache.Policy[discord.Role]) Option {
	return func(config *config) { config.rolePolicy = policy }
}

// WithMemberCachePolicy sets the policy applied before storing members.
func WithMemberCachePolicy(policy cache.Policy[discord.Member]) Option {
	return func(config *config) { config.memberPolicy = policy }
}

// WithThreadMemberCachePolicy sets the policy applied before storing thread members.
func WithThreadMemberCachePolicy(policy cache.Policy[discord.ThreadMember]) Option {
	return func(config *config) { config.threadMemberPolicy = policy }
}

// WithPresenceCachePolicy sets the policy applied before storing presences.
func WithPresenceCachePolicy(policy cache.Policy[discord.Presence]) Option {
	return func(config *config) { config.presencePolicy = policy }
}

// WithVoiceStateCachePolicy sets the policy applied before storing voice states.
func WithVoiceStateCachePolicy(policy cache.Policy[discord.VoiceState]) Option {
	return func(config *config) { config.voiceStatePolicy = policy }
}

// WithMessageCachePolicy sets the policy applied before storing messages.
func WithMessageCachePolicy(policy cache.Policy[discord.Message]) Option {
	return func(config *config) { config.messagePolicy = policy }
}

// WithEmojiCachePolicy sets the policy applied before storing emojis.
func WithEmojiCachePolicy(policy cache.Policy[discord.Emoji]) Option {
	return func(config *config) { config.emojiPolicy = policy }
}

// WithStickerCachePolicy sets the policy applied before storing stickers.
func WithStickerCachePolicy(policy cache.Policy[discord.Sticker]) Option {
	return func(config *config) { config.stickerPolicy = policy }
}
