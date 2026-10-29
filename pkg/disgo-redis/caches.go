package disgo_redis

import (
	"github.com/disgoorg/disgo/cache"
	"github.com/disgoorg/snowflake/v2"
	"github.com/redis/go-redis/v9"
)

const (
	selfUserCacheName             = "self-user"
	guildCacheName                = "guilds"
	unreadyGuildsCacheName        = "guilds:unready"
	unavailableGuildsCacheName    = "guilds:unavailable"
	channelCacheName              = "channels"
	stageInstanceCacheName        = "stage-instances"
	guildScheduledEventCacheName  = "guild-scheduled-events"
	guildSoundboardSoundCacheName = "guild-soundboard-sounds"
	roleCacheName                 = "roles"
	memberCacheName               = "members"
	threadMemberCacheName         = "thread-members"
	presenceCacheName             = "presences"
	voiceStateCacheName           = "voice-states"
	messageCacheName              = "messages"
	emojiCacheName                = "emojis"
	stickerCacheName              = "stickers"
)

var groupedCacheNames = []string{
	stageInstanceCacheName,
	guildScheduledEventCacheName,
	guildSoundboardSoundCacheName,
	roleCacheName,
	memberCacheName,
	threadMemberCacheName,
	presenceCacheName,
	voiceStateCacheName,
	messageCacheName,
	emojiCacheName,
	stickerCacheName,
}

// Caches is the composed Redis-backed cache returned by New. Close stops TTL
// renewal. It does not close the Redis client supplied by the caller.
type Caches struct {
	cache.Caches
	lease *leaseManager
}

// Close stops TTL renewal and gives all known cache keys one final full
// retention window. Close is safe to call more than once.
func (c *Caches) Close() {
	if c != nil && c.lease != nil {
		c.lease.close()
	}
}

// New returns a Redis-backed implementation of every cache interface exposed
// by Disgo. The returned value can be supplied directly to bot.WithCaches.
// Entity caches are disabled by default, matching cache.New; enable them with
// WithCaches.
func New(client redis.UniversalClient, options ...Option) *Caches {
	mustClient(client)
	cfg := applyOptions(options)
	flags := cfg.flags
	hashKeys, keyNames, groupedKeys := cacheKeyLayout(cfg)
	if cfg.clearOnStart {
		clearExistingCache(client, cfg, hashKeys, keyNames, groupedKeys)
	}

	var lease *leaseManager
	if cfg.ttl > 0 {
		lease = newLeaseManager(client, cfg, hashKeys, keyNames, groupedKeys)
	}

	selfUserCache := NewSelfUserCache(client, cfg.key(selfUserCacheName), options...)
	guildCache := cache.NewGuildCache(
		NewCache(client, cfg.key(guildCacheName), flags, cache.FlagGuilds, cfg.guildPolicy, options...),
		NewSet[snowflake.ID](client, cfg.key(unreadyGuildsCacheName), options...),
		NewSet[snowflake.ID](client, cfg.key(unavailableGuildsCacheName), options...),
	)
	channelCache := cache.NewChannelCache(
		NewCache(client, cfg.key(channelCacheName), flags, cache.FlagChannels, cfg.channelPolicy, options...),
	)
	stageInstanceCache := cache.NewStageInstanceCache(
		NewGroupedCache(client, cfg.key(stageInstanceCacheName), flags, cache.FlagStageInstances, cfg.stageInstancePolicy, options...),
	)
	guildScheduledEventCache := cache.NewGuildScheduledEventCache(
		NewGroupedCache(client, cfg.key(guildScheduledEventCacheName), flags, cache.FlagGuildScheduledEvents, cfg.guildScheduledEventPolicy, options...),
	)
	guildSoundboardSoundCache := cache.NewGuildSoundboardSoundCache(
		NewGroupedCache(client, cfg.key(guildSoundboardSoundCacheName), flags, cache.FlagGuildSoundboardSounds, cfg.guildSoundboardSoundPolicy, options...),
	)
	roleCache := cache.NewRoleCache(
		NewGroupedCache(client, cfg.key(roleCacheName), flags, cache.FlagRoles, cfg.rolePolicy, options...),
	)
	memberCache := cache.NewMemberCache(
		NewGroupedCache(client, cfg.key(memberCacheName), flags, cache.FlagMembers, cfg.memberPolicy, options...),
	)
	threadMemberCache := cache.NewThreadMemberCache(
		NewGroupedCache(client, cfg.key(threadMemberCacheName), flags, cache.FlagThreadMembers, cfg.threadMemberPolicy, options...),
	)
	presenceCache := cache.NewPresenceCache(
		NewGroupedCache(client, cfg.key(presenceCacheName), flags, cache.FlagPresences, cfg.presencePolicy, options...),
	)
	voiceStateCache := cache.NewVoiceStateCache(
		NewGroupedCache(client, cfg.key(voiceStateCacheName), flags, cache.FlagVoiceStates, cfg.voiceStatePolicy, options...),
	)
	messageCache := cache.NewMessageCache(
		NewGroupedCache(client, cfg.key(messageCacheName), flags, cache.FlagMessages, cfg.messagePolicy, options...),
	)
	emojiCache := cache.NewEmojiCache(
		NewGroupedCache(client, cfg.key(emojiCacheName), flags, cache.FlagEmojis, cfg.emojiPolicy, options...),
	)
	stickerCache := cache.NewStickerCache(
		NewGroupedCache(client, cfg.key(stickerCacheName), flags, cache.FlagStickers, cfg.stickerPolicy, options...),
	)

	result := &Caches{Caches: cache.New(
		cache.WithCaches(flags),
		cache.WithSelfUserCache(selfUserCache),
		cache.WithGuildCache(guildCache),
		cache.WithChannelCache(channelCache),
		cache.WithStageInstanceCache(stageInstanceCache),
		cache.WithGuildScheduledEventCache(guildScheduledEventCache),
		cache.WithGuildSoundboardSoundCache(guildSoundboardSoundCache),
		cache.WithRoleCache(roleCache),
		cache.WithMemberCache(memberCache),
		cache.WithThreadMemberCache(threadMemberCache),
		cache.WithPresenceCache(presenceCache),
		cache.WithVoiceStateCache(voiceStateCache),
		cache.WithMessageCache(messageCache),
		cache.WithEmojiCache(emojiCache),
		cache.WithStickerCache(stickerCache),
	), lease: lease}
	if lease != nil {
		lease.start()
	}
	return result
}

func cacheKeyLayout(cfg config) ([]string, []string, []groupedKeys) {
	hashes := []string{
		cfg.key(selfUserCacheName),
		cfg.key(guildCacheName),
		cfg.key(channelCacheName),
	}
	keys := []string{
		cfg.key(unreadyGuildsCacheName),
		cfg.key(unavailableGuildsCacheName),
	}
	grouped := make([]groupedKeys, 0, len(groupedCacheNames))
	for _, name := range groupedCacheNames {
		grouped = append(grouped, newGroupedKeys(cfg.key(name)))
	}
	return hashes, keys, grouped
}

func clearExistingCache(client redis.UniversalClient, cfg config, hashes []string, keys []string, grouped []groupedKeys) {
	ctx := cfg.context()
	toClear := append(append([]string(nil), hashes...), keys...)
	for _, groupKeys := range grouped {
		groups, err := client.SMembers(ctx, groupKeys.groups).Result()
		if err != nil {
			cfg.report("clear-on-start", groupKeys.logical, err)
		}
		for _, group := range groups {
			toClear = append(toClear, groupKeys.group(group))
		}
		toClear = append(toClear, groupKeys.groups)
	}
	// One UNLINK per key keeps the pipeline valid on Redis Cluster, where a
	// multi-key command must not span slots.
	commands := make([]*redis.IntCmd, len(toClear))
	_, err := client.Pipelined(ctx, func(pipe redis.Pipeliner) error {
		for i, key := range toClear {
			commands[i] = pipe.Unlink(ctx, key)
		}
		return nil
	})
	if err == nil {
		return
	}
	for i, command := range commands {
		if err := command.Err(); err != nil {
			cfg.report("clear-on-start", toClear[i], err)
		}
	}
}

var _ cache.Caches = (*Caches)(nil)
