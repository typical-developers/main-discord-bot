package disgox

import (
	"iter"

	"github.com/disgoorg/disgo/bot"
	"github.com/disgoorg/disgo/rest"
	"github.com/disgoorg/snowflake/v2"
)

// GetChannelAsType returns a channel from the cache, falling back to the API,
// as long as it is of the requested type.
func GetChannelAsType[T any](client *bot.Client, channelID snowflake.ID, opts ...rest.RequestOpt) (T, bool) {
	var zero T

	if c, exists := client.Caches.Channel(channelID); exists {
		asType, ok := c.(T)
		if !ok {
			return zero, false
		}

		return asType, true
	}

	channel, err := client.Rest.GetChannel(channelID, opts...)
	if err != nil {
		return zero, false
	}

	asType, ok := channel.(T)
	if !ok {
		return zero, false
	}

	return asType, true
}

// VoiceChannelMembers yields the IDs of the users connected to a voice channel, according to the cache.
func VoiceChannelMembers(client *bot.Client, guildID, channelID snowflake.ID) iter.Seq[snowflake.ID] {
	return func(yield func(snowflake.ID) bool) {
		for state := range client.Caches.VoiceStates(guildID) {
			if state.ChannelID == nil || *state.ChannelID != channelID {
				continue
			}

			if !yield(state.UserID) {
				return
			}
		}
	}
}

// RoleName returns a role's name from the cache, or a role mention if it isn't cached.
func RoleName(client *bot.Client, guildID, roleID snowflake.ID) string {
	if role, ok := client.Caches.Role(guildID, roleID); ok {
		return role.Name
	}

	return "<@&" + roleID.String() + ">"
}
