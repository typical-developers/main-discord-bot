package listeners

import (
	"fmt"
	"log/slog"
	"slices"

	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/events"
	"github.com/disgoorg/disgo/rest"
	"github.com/disgoorg/snowflake/v2"
	"github.com/typical-developers/main-discord-bot/internal/config"
	"github.com/typical-developers/main-discord-bot/internal/disgox"
)

// cameraBlocker disconnects members who turn on their camera in the configured guilds.
type cameraBlocker struct {
	guildIDs []snowflake.ID
}

func newCameraBlocker(cfg *config.Config) *events.ListenerAdapter {
	c := &cameraBlocker{guildIDs: cfg.Moderation.DisableCameraGuildIDs}

	return &events.ListenerAdapter{
		OnGuildVoiceStateUpdate: c.voiceStateUpdate,
	}
}

func (c *cameraBlocker) voiceStateUpdate(e *events.GuildVoiceStateUpdate) {
	state := e.VoiceState
	if !state.SelfVideo || state.ChannelID == nil || !slices.Contains(c.guildIDs, state.GuildID) {
		return
	}

	log := slog.With(
		slog.String("guild_id", state.GuildID.String()),
		slog.String("member_id", state.UserID.String()),
	)

	if err := disgox.DisconnectMember(e.Client().Rest, state.GuildID, state.UserID,
		rest.WithReason("Member enabled self video."),
	); err != nil {
		log.Error("failed to disconnect member with camera on", slog.Any("err", err))
		return
	}

	// voice channels have their own text chat, so let the member know why they were removed.
	if _, err := e.Client().Rest.CreateMessage(*state.ChannelID, discord.MessageCreate{
		Content: fmt.Sprintf("<@%s> we care about our members' safety, so enabling your camera is not allowed.", state.UserID),
	}); err != nil {
		log.Error("failed to send camera warning", slog.Any("err", err))
	}
}
