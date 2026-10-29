package disgo_redis

import (
	"fmt"

	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/json/v2"
)

// Codec serializes values stored in Redis. Implementations must be safe for
// concurrent use.
type Codec[T any] interface {
	Marshal(value T) ([]byte, error)
	Unmarshal(data []byte) (T, error)
}

// JSONCodec serializes values using Disgo's JSON implementation.
type JSONCodec[T any] struct{}

func (JSONCodec[T]) Marshal(value T) ([]byte, error) {
	return json.Marshal(value)
}

func (JSONCodec[T]) Unmarshal(data []byte) (value T, err error) {
	// GuildChannel is the only interface-valued entity in Disgo's cache API.
	// Its discriminator-aware wrapper is required because unmarshalling JSON
	// directly into an interface cannot select a concrete channel type.
	if target, ok := any(&value).(*discord.GuildChannel); ok {
		var raw discord.UnmarshalChannel
		if err = json.Unmarshal(data, &raw); err != nil {
			return value, err
		}
		channel, valid := raw.Channel.(discord.GuildChannel)
		if !valid {
			return value, fmt.Errorf("decoded channel %T is not a guild channel", raw.Channel)
		}
		*target = channel
		return value, nil
	}
	err = json.Unmarshal(data, &value)
	return
}
