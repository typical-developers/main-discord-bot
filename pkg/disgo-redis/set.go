package disgo_redis

import (
	"iter"

	"github.com/disgoorg/disgo/cache"
	"github.com/redis/go-redis/v9"
)

var _ cache.Set[string] = (*redisSet[string])(nil)

// NewSet returns a JSON-encoded Redis implementation of cache.Set.
func NewSet[T comparable](client redis.UniversalClient, key string, options ...Option) cache.Set[T] {
	return NewSetWithCodec(client, key, JSONCodec[T]{}, options...)
}

// NewSetWithCodec returns a Redis implementation of cache.Set using the
// supplied codec.
func NewSetWithCodec[T comparable](client redis.UniversalClient, key string, codec Codec[T], options ...Option) cache.Set[T] {
	mustClient(client)
	mustCodec(codec)
	return &redisSet[T]{
		client: client,
		key:    key,
		codec:  codec,
		config: applyOptions(options),
	}
}

type redisSet[T comparable] struct {
	client redis.UniversalClient
	key    string
	codec  Codec[T]
	config config
}

func (s *redisSet[T]) Add(item T) {
	data, err := s.codec.Marshal(item)
	if err != nil {
		s.config.report("encode", s.key, err)
		return
	}
	ctx := s.config.context()
	_, err = s.client.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
		pipe.SAdd(ctx, s.key, data)
		s.config.expire(ctx, pipe, s.key)
		return nil
	})
	if err != nil {
		s.config.report("add", s.key, err)
	}
}

func (s *redisSet[T]) Remove(item T) {
	data, err := s.codec.Marshal(item)
	if err != nil {
		s.config.report("encode", s.key, err)
		return
	}
	if err := s.client.SRem(s.config.context(), s.key, data).Err(); err != nil {
		s.config.report("remove", s.key, err)
	}
}

func (s *redisSet[T]) Has(item T) bool {
	data, err := s.codec.Marshal(item)
	if err != nil {
		s.config.report("encode", s.key, err)
		return false
	}
	has, err := s.client.SIsMember(s.config.context(), s.key, data).Result()
	if err != nil {
		s.config.report("has", s.key, err)
		return false
	}
	return has
}

func (s *redisSet[T]) Len() int {
	length, err := s.client.SCard(s.config.context(), s.key).Result()
	if err != nil {
		s.config.report("len", s.key, err)
		return 0
	}
	return int(length)
}

func (s *redisSet[T]) Clear() {
	if err := s.client.Unlink(s.config.context(), s.key).Err(); err != nil {
		s.config.report("clear", s.key, err)
	}
}

func (s *redisSet[T]) All() iter.Seq[T] {
	return func(yield func(T) bool) {
		values, err := s.client.SMembers(s.config.context(), s.key).Result()
		if err != nil {
			s.config.report("all", s.key, err)
			return
		}
		yieldDecoded(s.codec, s.config, s.key, values, yield)
	}
}
