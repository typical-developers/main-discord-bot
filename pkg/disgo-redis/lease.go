package disgo_redis

import (
	"context"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// leaseScanCount is the HSCAN batch size used while renewing field TTLs.
const leaseScanCount = 1000

// leaseManager keeps cache entries and metadata alive while a composed Caches
// is in use by periodically renewing every hash field's TTL and every metadata
// key's TTL. It keeps no per-entry state in memory: the fields to renew are
// read from Redis on each refresh.
type leaseManager struct {
	client  redis.UniversalClient
	config  config
	hashes  []string
	keys    []string
	grouped []groupedKeys

	stop      chan struct{}
	done      chan struct{}
	closeOnce sync.Once
}

func newLeaseManager(client redis.UniversalClient, cfg config, hashes []string, keys []string, grouped []groupedKeys) *leaseManager {
	metadata := append([]string(nil), keys...)
	for _, groupKeys := range grouped {
		metadata = append(metadata, groupKeys.groups)
	}
	return &leaseManager{
		client:  client,
		config:  cfg,
		hashes:  hashes,
		keys:    metadata,
		grouped: grouped,
		stop:    make(chan struct{}),
		done:    make(chan struct{}),
	}
}

func (m *leaseManager) start() {
	m.refresh()
	go func() {
		defer close(m.done)
		interval := m.config.ttl / 3
		if interval <= 0 {
			interval = m.config.ttl
		}
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				m.refresh()
			case <-m.stop:
				return
			}
		}
	}()
}

func (m *leaseManager) close() {
	m.closeOnce.Do(func() {
		close(m.stop)
		<-m.done
		// Give every entry and metadata key the same final retention window.
		m.refresh()
	})
}

func (m *leaseManager) refresh() {
	ctx := m.config.context()
	for _, key := range m.hashes {
		m.renewHash(ctx, key, key)
	}
	for _, groupKeys := range m.grouped {
		groups, err := m.client.SMembers(ctx, groupKeys.groups).Result()
		if err != nil {
			m.config.report("lease-discover", groupKeys.logical, err)
			continue
		}
		for _, group := range groups {
			if m.renewHash(ctx, groupKeys.group(group), groupKeys.logical) {
				continue
			}
			if err := pruneGroup(ctx, m.client, groupKeys, group); err != nil {
				m.config.report("lease-prune", groupKeys.logical, err)
			}
		}
	}
	m.renewKeys(ctx)
}

// renewHash resets the TTL of every field in the hash at key. It reports
// whether the hash had any fields; scan errors count as non-empty so the caller
// does not prune a group it could not inspect.
func (m *leaseManager) renewHash(ctx context.Context, key string, logicalKey string) bool {
	found := false
	var cursor uint64
	for {
		fields, next, err := m.client.HScanNoValues(ctx, key, cursor, "", leaseScanCount).Result()
		if err != nil {
			m.config.report("lease-discover", logicalKey, err)
			return true
		}
		if len(fields) != 0 {
			found = true
			if err := m.client.HPExpire(ctx, key, m.config.ttl, fields...).Err(); err != nil {
				m.config.report("expire-field", logicalKey, err)
			}
		}
		if next == 0 {
			return found
		}
		cursor = next
	}
}

func (m *leaseManager) renewKeys(ctx context.Context) {
	commands := make([]*redis.BoolCmd, len(m.keys))
	_, err := m.client.Pipelined(ctx, func(pipe redis.Pipeliner) error {
		for i, key := range m.keys {
			commands[i] = pipe.PExpire(ctx, key, m.config.ttl)
		}
		return nil
	})
	if err == nil {
		return
	}
	for i, command := range commands {
		if err := command.Err(); err != nil {
			m.config.report("expire", m.keys[i], err)
		}
	}
}
