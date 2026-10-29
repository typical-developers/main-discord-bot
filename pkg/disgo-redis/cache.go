package disgo_redis

import (
	"iter"

	"github.com/disgoorg/disgo/cache"
	"github.com/disgoorg/snowflake/v2"
	"github.com/redis/go-redis/v9"
)

var _ cache.Cache[any] = (*redisCache[any])(nil)

// NewCache returns a JSON-encoded Redis implementation of cache.Cache.
func NewCache[T any](client redis.UniversalClient, key string, flags cache.Flags, neededFlags cache.Flags, policy cache.Policy[T], options ...Option) cache.Cache[T] {
	return NewCacheWithCodec(client, key, flags, neededFlags, policy, JSONCodec[T]{}, options...)
}

// NewCacheWithCodec returns a Redis implementation of cache.Cache using the
// supplied codec.
func NewCacheWithCodec[T any](client redis.UniversalClient, key string, flags cache.Flags, neededFlags cache.Flags, policy cache.Policy[T], codec Codec[T], options ...Option) cache.Cache[T] {
	mustClient(client)
	mustCodec(codec)
	return &redisCache[T]{
		client:      client,
		key:         key,
		flags:       flags,
		neededFlags: neededFlags,
		policy:      policy,
		codec:       codec,
		config:      applyOptions(options),
	}
}

type redisCache[T any] struct {
	client      redis.UniversalClient
	key         string
	flags       cache.Flags
	neededFlags cache.Flags
	policy      cache.Policy[T]
	codec       Codec[T]
	config      config
}

func (c *redisCache[T]) Get(id snowflake.ID) (T, bool) {
	data, err := c.client.HGet(c.config.context(), c.key, id.String()).Result()
	return decodeResult(c.codec, c.config, "get", c.key, data, err)
}

func (c *redisCache[T]) Put(id snowflake.ID, entity T) {
	if c.flags.Missing(c.neededFlags) || c.policy != nil && !c.policy(entity) {
		return
	}
	data, err := c.codec.Marshal(entity)
	if err != nil {
		c.config.report("encode", c.key, err)
		return
	}
	ctx := c.config.context()
	if err := c.config.hset(ctx, c.client, c.key, id.String(), data).Err(); err != nil {
		c.config.report("put", c.key, err)
	}
}

func (c *redisCache[T]) Remove(id snowflake.ID) (T, bool) {
	values, err := c.client.HGetDel(c.config.context(), c.key, id.String()).Result()
	return decodeResult(c.codec, c.config, "remove", c.key, firstValue(values), err)
}

func (c *redisCache[T]) RemoveIf(filterFunc cache.FilterFunc[T]) {
	if filterFunc == nil {
		return
	}
	err := removeFieldsIf(c.config.context(), c.client, c.key, func(_ string, data string) bool {
		value, err := c.codec.Unmarshal([]byte(data))
		if err != nil {
			c.config.report("decode", c.key, err)
			return false
		}
		return filterFunc(value)
	}, nil)
	if err != nil {
		c.config.report("remove-if", c.key, err)
	}
}

func (c *redisCache[T]) Len() int {
	length, err := c.client.HLen(c.config.context(), c.key).Result()
	if err != nil {
		c.config.report("len", c.key, err)
		return 0
	}
	return int(length)
}

func (c *redisCache[T]) All() iter.Seq[T] {
	return func(yield func(T) bool) {
		values, err := c.client.HVals(c.config.context(), c.key).Result()
		if err != nil {
			c.config.report("all", c.key, err)
			return
		}
		yieldDecoded(c.codec, c.config, c.key, values, yield)
	}
}
