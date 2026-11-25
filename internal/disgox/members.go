package disgox

import (
	"github.com/disgoorg/disgo/rest"
	"github.com/disgoorg/snowflake/v2"
)

// DisconnectMember removes a member from their voice channel.
//
// discord.MemberUpdate omits a nil ChannelID instead of sending null,
// so the request body is built by hand.
func DisconnectMember(r rest.Rest, guildID, userID snowflake.ID, opts ...rest.RequestOpt) error {
	return r.Do(rest.UpdateMember.Compile(nil, guildID, userID), map[string]any{"channel_id": nil}, nil, opts...)
}

// MoveMember moves a member into another voice channel.
func MoveMember(r rest.Rest, guildID, userID, channelID snowflake.ID, opts ...rest.RequestOpt) error {
	return r.Do(rest.UpdateMember.Compile(nil, guildID, userID), map[string]any{"channel_id": channelID}, nil, opts...)
}
