package disgo_redis

import (
	"context"
	"errors"

	"github.com/redis/go-redis/v9"
)

// maxWatchAttempts bounds how often an optimistic WATCH/MULTI transaction is
// retried when another client modifies the watched key first.
const maxWatchAttempts = 5

func mustClient(client redis.UniversalClient) {
	if client == nil {
		panic("disgo_redis: nil Redis client")
	}
}

func mustCodec[T any](codec Codec[T]) {
	if codec == nil {
		panic("disgo_redis: nil codec")
	}
}

// decodeResult converts the result of a single-value read into a cache lookup.
// Missing values (redis.Nil or an empty string) are reported as cache misses.
func decodeResult[T any](codec Codec[T], cfg config, operation string, key string, data string, err error) (zero T, ok bool) {
	if errors.Is(err, redis.Nil) {
		return zero, false
	}
	if err != nil {
		cfg.report(operation, key, err)
		return zero, false
	}
	if data == "" {
		return zero, false
	}
	value, err := codec.Unmarshal([]byte(data))
	if err != nil {
		cfg.report("decode", key, err)
		return zero, false
	}
	return value, true
}

// firstValue returns the first element of a multi-value reply such as HGETDEL.
// go-redis reports missing fields as empty strings.
func firstValue(values []string) string {
	if len(values) == 0 {
		return ""
	}
	return values[0]
}

// yieldDecoded decodes each value and passes it to yield, skipping values that
// fail to decode. It returns false if yield asked to stop.
func yieldDecoded[T any](codec Codec[T], cfg config, key string, values []string, yield func(T) bool) bool {
	for _, data := range values {
		value, err := codec.Unmarshal([]byte(data))
		if err != nil {
			cfg.report("decode", key, err)
			continue
		}
		if !yield(value) {
			return false
		}
	}
	return true
}

// removeFieldsIf deletes every field of the hash at key whose value matches.
// The read and the delete run in one WATCH/MULTI transaction, so a field that
// another client rewrites in between is not removed; the transaction is retried
// instead. When onEmpty is non-nil it is queued in the same transaction if the
// hash will have no fields left afterwards.
//
// If the hash keeps changing for maxWatchAttempts attempts, one final
// unguarded pass removes the matching fields anyway so RemoveIf always makes
// progress. That pass may drop an entry rewritten a moment earlier, which only
// costs a cache miss; it skips onEmpty, leaving index cleanup to the
// WATCH-guarded pruning done by later reads.
func removeFieldsIf(ctx context.Context, client redis.UniversalClient, key string, match func(field string, data string) bool, onEmpty func(redis.Pipeliner)) error {
	selectFields := func(reader redis.Cmdable) ([]string, bool, error) {
		values, err := reader.HGetAll(ctx, key).Result()
		if err != nil {
			return nil, false, err
		}
		fields := make([]string, 0, len(values))
		for field, data := range values {
			if match(field, data) {
				fields = append(fields, field)
			}
		}
		return fields, len(fields) == len(values), nil
	}

	err := watchWithRetry(ctx, client, func(tx *redis.Tx) error {
		fields, empty, err := selectFields(tx)
		if err != nil {
			return err
		}
		empty = empty && onEmpty != nil
		if len(fields) == 0 && !empty {
			return nil
		}
		_, err = tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
			if len(fields) != 0 {
				pipe.HDel(ctx, key, fields...)
			}
			if empty {
				onEmpty(pipe)
			}
			return nil
		})
		return err
	}, key)
	if !errors.Is(err, redis.TxFailedErr) {
		return err
	}

	fields, _, err := selectFields(client)
	if err != nil || len(fields) == 0 {
		return err
	}
	return client.HDel(ctx, key, fields...).Err()
}

// watchWithRetry runs fn inside WATCH on keys, retrying when the optimistic
// transaction is aborted because a watched key changed.
func watchWithRetry(ctx context.Context, client redis.UniversalClient, fn func(*redis.Tx) error, keys ...string) error {
	var err error
	for range maxWatchAttempts {
		err = client.Watch(ctx, fn, keys...)
		if !errors.Is(err, redis.TxFailedErr) {
			return err
		}
	}
	return err
}
