// Package cache has small in-memory caches.
package cache

import (
	"sync"
	"time"
)

// TTL is a size-bounded cache whose entries expire a fixed time after they're set. It's safe for
// concurrent use.
//
// When it's full, setting a new entry drops the expired entries first, then arbitrary ones until
// there's room.
type TTL[K comparable, V any] struct {
	ttl        time.Duration
	maxEntries int

	mu      sync.Mutex
	entries map[K]ttlEntry[V]
}

type ttlEntry[V any] struct {
	value   V
	expires time.Time
}

// NewTTL creates a cache whose entries expire after ttl, holding at most maxEntries entries.
func NewTTL[K comparable, V any](ttl time.Duration, maxEntries int) *TTL[K, V] {
	return &TTL[K, V]{
		ttl:        ttl,
		maxEntries: maxEntries,
		entries:    make(map[K]ttlEntry[V]),
	}
}

// Get returns the value for key, or false if it isn't cached or has expired.
func (c *TTL[K, V]) Get(key K) (V, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	entry, ok := c.entries[key]
	if !ok || time.Now().After(entry.expires) {
		var zero V
		return zero, false
	}

	return entry.value, true
}

// Set caches value for key, replacing any existing entry and restarting its expiry.
func (c *TTL[K, V]) Set(key K, value V) {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now()
	if _, exists := c.entries[key]; !exists && len(c.entries) >= c.maxEntries {
		for k, entry := range c.entries {
			if now.After(entry.expires) {
				delete(c.entries, k)
			}
		}
		for k := range c.entries {
			if len(c.entries) < c.maxEntries {
				break
			}
			delete(c.entries, k)
		}
	}

	c.entries[key] = ttlEntry[V]{value: value, expires: now.Add(c.ttl)}
}
