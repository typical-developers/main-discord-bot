package disgo_redis

import (
	"context"
	"errors"
	"iter"

	"github.com/disgoorg/disgo/cache"
	"github.com/disgoorg/snowflake/v2"
	"github.com/redis/go-redis/v9"
)

var _ cache.GroupedCache[any] = (*redisGroupedCache[any])(nil)

// NewGroupedCache returns a JSON-encoded Redis implementation of
// cache.GroupedCache.
func NewGroupedCache[T any](client redis.UniversalClient, key string, flags cache.Flags, neededFlags cache.Flags, policy cache.Policy[T], options ...Option) cache.GroupedCache[T] {
	return NewGroupedCacheWithCodec(client, key, flags, neededFlags, policy, JSONCodec[T]{}, options...)
}

// NewGroupedCacheWithCodec returns a Redis implementation of
// cache.GroupedCache using the supplied codec.
func NewGroupedCacheWithCodec[T any](client redis.UniversalClient, key string, flags cache.Flags, neededFlags cache.Flags, policy cache.Policy[T], codec Codec[T], options ...Option) cache.GroupedCache[T] {
	mustClient(client)
	mustCodec(codec)
	return &redisGroupedCache[T]{
		client:      client,
		keys:        newGroupedKeys(key),
		flags:       flags,
		neededFlags: neededFlags,
		policy:      policy,
		codec:       codec,
		config:      applyOptions(options),
	}
}

// groupedKeys describes the Redis layout of a grouped cache. Every group is a
// hash at <prefix>:group:<groupID>, and <prefix>:groups is a set indexing the
// group IDs so the whole cache can be enumerated without SCAN. The prefix is
// wrapped in a hash tag so a group hash and the index always share a Redis
// Cluster slot, which MULTI/EXEC and WATCH require.
type groupedKeys struct {
	logical string
	prefix  string
	groups  string
}

func newGroupedKeys(key string) groupedKeys {
	prefix := "{" + key + "}"
	return groupedKeys{
		logical: key,
		prefix:  prefix,
		groups:  prefix + ":groups",
	}
}

func (k groupedKeys) group(groupID string) string {
	return k.prefix + ":group:" + groupID
}

type redisGroupedCache[T any] struct {
	client      redis.UniversalClient
	keys        groupedKeys
	flags       cache.Flags
	neededFlags cache.Flags
	policy      cache.Policy[T]
	codec       Codec[T]
	config      config
}

func (c *redisGroupedCache[T]) Get(groupID snowflake.ID, id snowflake.ID) (T, bool) {
	data, err := c.client.HGet(c.config.context(), c.keys.group(groupID.String()), id.String()).Result()
	return decodeResult(c.codec, c.config, "get", c.keys.logical, data, err)
}

func (c *redisGroupedCache[T]) Put(groupID snowflake.ID, id snowflake.ID, entity T) {
	if c.flags.Missing(c.neededFlags) || c.policy != nil && !c.policy(entity) {
		return
	}
	data, err := c.codec.Marshal(entity)
	if err != nil {
		c.config.report("encode", c.keys.logical, err)
		return
	}
	ctx := c.config.context()
	group := groupID.String()
	_, err = c.client.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
		c.config.hset(ctx, pipe, c.keys.group(group), id.String(), data)
		pipe.SAdd(ctx, c.keys.groups, group)
		c.config.expire(ctx, pipe, c.keys.groups)
		return nil
	})
	if err != nil {
		c.config.report("put", c.keys.logical, err)
	}
}

func (c *redisGroupedCache[T]) Remove(groupID snowflake.ID, id snowflake.ID) (T, bool) {
	ctx := c.config.context()
	group := groupID.String()
	key := c.keys.group(group)
	var (
		removed *redis.StringSliceCmd
		exists  *redis.IntCmd
	)
	_, err := c.client.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
		removed = pipe.HGetDel(ctx, key, id.String())
		exists = pipe.Exists(ctx, key)
		return nil
	})
	if err == nil && exists.Val() == 0 {
		// Redis deletes a hash together with its last field.
		c.pruneGroup(ctx, group, "remove")
	}
	return decodeResult(c.codec, c.config, "remove", c.keys.logical, firstValue(removed.Val()), err)
}

func (c *redisGroupedCache[T]) GroupRemove(groupID snowflake.ID) {
	ctx := c.config.context()
	group := groupID.String()
	_, err := c.client.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
		pipe.Unlink(ctx, c.keys.group(group))
		pipe.SRem(ctx, c.keys.groups, group)
		return nil
	})
	if err != nil {
		c.config.report("group-remove", c.keys.logical, err)
	}
}

func (c *redisGroupedCache[T]) RemoveIf(filterFunc cache.GroupedFilterFunc[T]) {
	if filterFunc == nil {
		return
	}
	for _, groupID := range c.groupIDs("remove-if") {
		c.removeGroupIf(groupID, filterFunc, "remove-if")
	}
}

func (c *redisGroupedCache[T]) GroupRemoveIf(groupID snowflake.ID, filterFunc cache.GroupedFilterFunc[T]) {
	if filterFunc == nil {
		return
	}
	c.removeGroupIf(groupID, filterFunc, "group-remove-if")
}

func (c *redisGroupedCache[T]) removeGroupIf(groupID snowflake.ID, filterFunc cache.GroupedFilterFunc[T], operation string) {
	ctx := c.config.context()
	group := groupID.String()
	err := removeFieldsIf(ctx, c.client, c.keys.group(group), func(_ string, data string) bool {
		value, err := c.codec.Unmarshal([]byte(data))
		if err != nil {
			c.config.report("decode", c.keys.logical, err)
			return false
		}
		return filterFunc(groupID, value)
	}, func(pipe redis.Pipeliner) {
		pipe.SRem(ctx, c.keys.groups, group)
	})
	if err != nil {
		c.config.report(operation, c.keys.logical, err)
	}
}

func (c *redisGroupedCache[T]) Len() int {
	groupIDs := c.groupIDs("len")
	if len(groupIDs) == 0 {
		return 0
	}
	ctx := c.config.context()
	commands := make([]*redis.IntCmd, len(groupIDs))
	_, err := c.client.Pipelined(ctx, func(pipe redis.Pipeliner) error {
		for i, groupID := range groupIDs {
			commands[i] = pipe.HLen(ctx, c.keys.group(groupID.String()))
		}
		return nil
	})
	if err != nil {
		c.config.report("len", c.keys.logical, err)
		return 0
	}
	total := 0
	for i, command := range commands {
		length := command.Val()
		if length == 0 {
			c.pruneGroup(ctx, groupIDs[i].String(), "len")
		}
		total += int(length)
	}
	return total
}

func (c *redisGroupedCache[T]) GroupLen(groupID snowflake.ID) int {
	ctx := c.config.context()
	length, err := c.client.HLen(ctx, c.keys.group(groupID.String())).Result()
	if err != nil {
		c.config.report("group-len", c.keys.logical, err)
		return 0
	}
	if length == 0 {
		c.pruneGroup(ctx, groupID.String(), "group-len")
	}
	return int(length)
}

func (c *redisGroupedCache[T]) All() iter.Seq2[snowflake.ID, T] {
	return func(yield func(snowflake.ID, T) bool) {
		for _, groupID := range c.groupIDs("all") {
			if !c.yieldGroup(groupID, "all", func(value T) bool { return yield(groupID, value) }) {
				return
			}
		}
	}
}

func (c *redisGroupedCache[T]) GroupAll(groupID snowflake.ID) iter.Seq[T] {
	return func(yield func(T) bool) {
		c.yieldGroup(groupID, "group-all", yield)
	}
}

// yieldGroup decodes every entity of one group and passes it to yield. It
// returns false if yield asked to stop.
func (c *redisGroupedCache[T]) yieldGroup(groupID snowflake.ID, operation string, yield func(T) bool) bool {
	ctx := c.config.context()
	values, err := c.client.HVals(ctx, c.keys.group(groupID.String())).Result()
	if err != nil {
		c.config.report(operation, c.keys.logical, err)
		return true
	}
	if len(values) == 0 {
		c.pruneGroup(ctx, groupID.String(), operation)
		return true
	}
	return yieldDecoded(c.codec, c.config, c.keys.logical, values, yield)
}

func (c *redisGroupedCache[T]) groupIDs(operation string) []snowflake.ID {
	values, err := c.client.SMembers(c.config.context(), c.keys.groups).Result()
	if err != nil {
		c.config.report(operation, c.keys.logical, err)
		return nil
	}
	groupIDs := make([]snowflake.ID, 0, len(values))
	for _, value := range values {
		id, err := snowflake.Parse(value)
		if err != nil {
			c.config.report("decode-group-id", c.keys.logical, err)
			continue
		}
		groupIDs = append(groupIDs, id)
	}
	return groupIDs
}

func (c *redisGroupedCache[T]) pruneGroup(ctx context.Context, group string, operation string) {
	if err := pruneGroup(ctx, c.client, c.keys, group); err != nil {
		c.config.report(operation, c.keys.logical, err)
	}
}

// pruneGroup removes group from the index if its hash no longer exists (Redis
// deletes a hash once its last field is removed or expires). The group hash is
// WATCHed, so a concurrent Put that recreates the group aborts the removal
// instead of leaving the new entries unindexed.
func pruneGroup(ctx context.Context, client redis.UniversalClient, keys groupedKeys, group string) error {
	key := keys.group(group)
	err := client.Watch(ctx, func(tx *redis.Tx) error {
		exists, err := tx.Exists(ctx, key).Result()
		if err != nil || exists != 0 {
			return err
		}
		_, err = tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
			pipe.SRem(ctx, keys.groups, group)
			return nil
		})
		return err
	}, key)
	if errors.Is(err, redis.TxFailedErr) {
		// The group was written to concurrently, so it must stay indexed.
		return nil
	}
	return err
}
