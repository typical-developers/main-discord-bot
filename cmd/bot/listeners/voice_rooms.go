package listeners

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/events"
	"github.com/disgoorg/disgo/rest"
	"github.com/disgoorg/omit"
	"github.com/disgoorg/snowflake/v2"
	"github.com/typical-developers/main-discord-bot/common"
	"github.com/typical-developers/main-discord-bot/internal/database"
	"github.com/typical-developers/main-discord-bot/internal/disgox"
)

// voiceRoomCreationCooldown is how long a member has to wait between creating voice rooms.
const voiceRoomCreationCooldown = time.Second * 30

// voiceRooms creates a voice room when a member joins a lobby, transfers ownership when
// the owner leaves, and deletes rooms once everyone has left.
type voiceRooms struct {
	db *database.Database

	mu sync.Mutex
	// when each member can next create a voice room.
	cooldowns map[snowflake.ID]time.Time
}

func newVoiceRooms(db *database.Database) *events.ListenerAdapter {
	v := &voiceRooms{
		db:        db,
		cooldowns: make(map[snowflake.ID]time.Time),
	}

	return &events.ListenerAdapter{
		OnGuildVoiceStateUpdate: v.voiceStateUpdate,
	}
}

func (v *voiceRooms) voiceStateUpdate(e *events.GuildVoiceStateUpdate) {
	oldChannel := e.OldVoiceState.ChannelID
	newChannel := e.VoiceState.ChannelID

	// mute, deafen, camera etc. also send voice state updates. Only channel changes matter here.
	if oldChannel != nil && newChannel != nil && *oldChannel == *newChannel {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), listenerTimeout)
	defer cancel()

	if oldChannel != nil {
		v.left(ctx, e, *oldChannel)
	}

	if newChannel != nil {
		v.joined(ctx, e, *newChannel)
	}
}

// joined creates a voice room if the member joined a lobby.
func (v *voiceRooms) joined(ctx context.Context, e *events.GuildVoiceStateUpdate, channelID snowflake.ID) {
	guildID := e.VoiceState.GuildID
	member := e.Member
	client := e.Client()

	log := slog.With(
		slog.String("guild_id", guildID.String()),
		slog.String("member_id", member.User.ID.String()),
		slog.String("lobby_id", channelID.String()),
	)

	lobby, err := v.db.VoiceRooms.GetLobby(ctx, guildID, channelID)
	if err != nil {
		if !errors.Is(err, database.ErrVoiceRoomLobbyNotFound) {
			log.Error("failed to get voice room lobby", slog.Any("err", err))
		}
		return
	}

	// sends a message in the lobby's text chat and removes the member from the lobby.
	rejectMember := func(content string) {
		_, _ = client.Rest.CreateMessage(channelID, discord.MessageCreate{Content: content})
		_, _ = client.Rest.UpdateMember(guildID, member.User.ID, discord.MemberUpdate{ChannelID: omit.NewNilPtr[snowflake.ID]()})
	}

	if !v.startCooldown(member.User.ID) {
		rejectMember(fmt.Sprintf("<@%s> you are on a cooldown, please try again in a bit.", member.User.ID))
		return
	}

	create := discord.GuildVoiceChannelCreate{
		Name:      fmt.Sprintf("%s's Voice Room", member.EffectiveName()),
		UserLimit: int(lobby.UserLimit),
	}
	if lobbyChannel, ok := client.Caches.Channel(channelID); ok && lobbyChannel.ParentID() != nil {
		create.ParentID = *lobbyChannel.ParentID()
	}

	failed := func(err error) {
		log.Error("failed to create voice room", slog.Any("err", err))
		v.clearCooldown(member.User.ID)
		rejectMember(fmt.Sprintf("<@%s> failed to create a voice room. Please try again later.", member.User.ID))
	}

	channel, err := client.Rest.CreateGuildChannel(guildID, create, rest.WithReason("Automated Action - Member joined a voice room lobby."))
	if err != nil {
		failed(err)
		return
	}

	room, err := v.db.VoiceRooms.RegisterRoom(ctx, guildID, channelID, channel.ID(), member.User.ID)
	if err != nil {
		_ = client.Rest.DeleteChannel(channel.ID())
		failed(err)
		return
	}

	// an empty room is only deleted when someone leaves it, so one nobody was moved into would
	// stay forever (e.g. the member left the lobby while it was being created).
	if _, err := client.Rest.UpdateMember(guildID, member.User.ID, discord.MemberUpdate{ChannelID: omit.NewPtr(channel.ID())}); err != nil {
		log.Error("failed to move member into their voice room", slog.Any("err", err))
		v.clearCooldown(member.User.ID)

		if err := v.db.VoiceRooms.DeleteRoom(ctx, guildID, channel.ID()); err != nil {
			log.Error("failed to delete unused voice room", slog.Any("err", err))
		}
		if err := client.Rest.DeleteChannel(channel.ID(), rest.WithReason("Automated Action - Member could not be moved into their voice room.")); err != nil {
			log.Error("failed to delete unused voice room channel", slog.Any("err", err))
		}
		return
	}

	if _, err := client.Rest.CreateMessage(channel.ID(), discord.MessageCreate{
		Flags:      discord.MessageFlagIsComponentsV2,
		Components: []discord.LayoutComponent{common.VoiceRoomPanel(room, lobby)},
		// the panel mentions the creator and owner, they don't need to be pinged.
		AllowedMentions: &discord.AllowedMentions{},
	}); err != nil {
		log.Error("failed to send voice room panel", slog.Any("err", err))
	}
}

// left deletes a voice room once it's empty, or transfers its ownership if the owner left.
func (v *voiceRooms) left(ctx context.Context, e *events.GuildVoiceStateUpdate, channelID snowflake.ID) {
	guildID := e.VoiceState.GuildID
	client := e.Client()

	log := slog.With(
		slog.String("guild_id", guildID.String()),
		slog.String("channel_id", channelID.String()),
	)

	room, err := v.db.VoiceRooms.GetRoom(ctx, guildID, channelID)
	if err != nil {
		if !errors.Is(err, database.ErrVoiceRoomNotFound) {
			log.Error("failed to get voice room", slog.Any("err", err))
		}
		return
	}

	var remaining []snowflake.ID
	for userID := range disgox.VoiceChannelMembers(client, guildID, channelID) {
		remaining = append(remaining, userID)
	}

	if len(remaining) == 0 {
		if err := v.db.VoiceRooms.DeleteRoom(ctx, guildID, channelID); err != nil {
			log.Error("failed to delete empty voice room", slog.Any("err", err))
			return
		}

		if err := client.Rest.DeleteChannel(channelID, rest.WithReason("Automated Action - No users in voice room.")); err != nil {
			log.Error("failed to delete empty voice room channel", slog.Any("err", err))
		}
		return
	}

	if room.CurrentOwnerID != e.Member.User.ID {
		return
	}

	nextOwner := remaining[0]
	if _, err := v.db.VoiceRooms.UpdateRoom(ctx, guildID, channelID, database.UpdateVoiceRoomOpts{CurrentOwnerID: &nextOwner}); err != nil {
		log.Error("failed to transfer voice room ownership", slog.Any("err", err))
	}
}

// startCooldown starts the member's creation cooldown, or reports false if they're already on one.
func (v *voiceRooms) startCooldown(memberID snowflake.ID) bool {
	v.mu.Lock()
	defer v.mu.Unlock()

	now := time.Now()
	if until, ok := v.cooldowns[memberID]; ok && now.Before(until) {
		return false
	}

	// drop expired cooldowns so the map doesn't grow forever.
	for id, until := range v.cooldowns {
		if !now.Before(until) {
			delete(v.cooldowns, id)
		}
	}

	v.cooldowns[memberID] = now.Add(voiceRoomCreationCooldown)
	return true
}

// clearCooldown removes a member's cooldown, so a failed creation doesn't count against them.
func (v *voiceRooms) clearCooldown(memberID snowflake.ID) {
	v.mu.Lock()
	defer v.mu.Unlock()

	delete(v.cooldowns, memberID)
}
