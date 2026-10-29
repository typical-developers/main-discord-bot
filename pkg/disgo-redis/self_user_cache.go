package disgo_redis

import (
	"github.com/disgoorg/disgo/cache"
	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/snowflake/v2"
	"github.com/redis/go-redis/v9"
)

const selfUserID snowflake.ID = 0

var _ cache.SelfUserCache = (*redisSelfUserCache)(nil)

// NewSelfUserCache returns a Redis implementation of cache.SelfUserCache.
func NewSelfUserCache(client redis.UniversalClient, key string, options ...Option) cache.SelfUserCache {
	return &redisSelfUserCache{
		cache: NewCache(
			client,
			key,
			cache.FlagsAll,
			cache.FlagsNone,
			cache.PolicyAll[discord.OAuth2User],
			options...,
		),
	}
}

type redisSelfUserCache struct {
	cache cache.Cache[discord.OAuth2User]
}

func (c *redisSelfUserCache) SelfUser() (discord.OAuth2User, bool) {
	return c.cache.Get(selfUserID)
}

func (c *redisSelfUserCache) SetSelfUser(selfUser discord.OAuth2User) {
	c.cache.Put(selfUserID, selfUser)
}
