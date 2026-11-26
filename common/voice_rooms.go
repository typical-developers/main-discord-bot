package common

import (
	"fmt"

	"github.com/disgoorg/disgo/discord"
	"github.com/typical-developers/main-discord-bot/internal/database/gen"
	"github.com/typical-developers/main-discord-bot/internal/emojis"
	"github.com/typical-developers/main-discord-bot/internal/ptr"
)

// Custom IDs for the voice room management panel.
// They're handled in cmd/bot/components.
const (
	VoiceRoomRenameID       = "/voice-room/rename"
	VoiceRoomRenameSubmitID = "/voice-room/rename-submit"
	VoiceRoomToggleLockID   = "/voice-room/toggle-lock"
	VoiceRoomLimitID        = "/voice-room/adjust-limit"
	VoiceRoomLimitSubmitID  = "/voice-room/adjust-limit-submit"
	VoiceRoomReclaimID      = "/voice-room/reclaim"
	VoiceRoomCloseID        = "/voice-room/close"
)

// VoiceRoomPanel builds the management panel posted in every voice room.
// It must be sent with discord.MessageFlagIsComponentsV2.
func VoiceRoomPanel(room gen.GuildActiveVoiceRoom, lobby gen.GuildVoiceRoomsSetting) discord.ContainerComponent {
	lockEmoji := emojis.EmojiLock
	if ptr.Value(room.IsLocked) {
		lockEmoji = emojis.EmojiUnlock
	}

	return discord.NewContainer(
		discord.NewTextDisplay("### 🔉 Voice Room Management"),
		discord.NewTextDisplay("The voice room owner can use the buttons below to manage the state of the voice room."),
		discord.NewLargeSeparator(),
		discord.NewTextDisplay(fmt.Sprintf(
			"**Created By:** <@%s>\n**Current Owner:** <@%s>\n**Locked:** `%t`",
			room.CreatedByUserID, room.CurrentOwnerID, ptr.Value(room.IsLocked),
		)),
		discord.NewActionRow(
			discord.NewSecondaryButton("Rename Room", VoiceRoomRenameID).
				WithEmoji(emojis.Component(emojis.EmojiRename)).
				WithDisabled(!lobby.CanRename),
			discord.NewSecondaryButton("Toggle Locked", VoiceRoomToggleLockID).
				WithEmoji(emojis.Component(lockEmoji)).
				WithDisabled(!lobby.CanLock),
			discord.NewSecondaryButton("Adjust Limit", VoiceRoomLimitID).
				WithEmoji(emojis.Component(emojis.EmojiUserLimit)).
				WithDisabled(!lobby.CanAdjustLimit),
		),
		discord.NewActionRow(
			discord.NewSuccessButton("Reclaim Ownership", VoiceRoomReclaimID).
				WithEmoji(emojis.Component(emojis.EmojiReclaim)),
			discord.NewDangerButton("Close Room", VoiceRoomCloseID).
				WithEmoji(emojis.Component(emojis.EmojiClose)),
		),
	)
}
