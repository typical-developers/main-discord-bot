package components

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"strings"

	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/handler"
	"github.com/disgoorg/disgo/rest"
	"github.com/disgoorg/snowflake/v2"
	"github.com/typical-developers/main-discord-bot/cmd/bot/handlers"
	"github.com/typical-developers/main-discord-bot/common"
	"github.com/typical-developers/main-discord-bot/internal/database"
	"github.com/typical-developers/main-discord-bot/internal/database/gen"
	"github.com/typical-developers/main-discord-bot/internal/disgox"
	"github.com/typical-developers/main-discord-bot/internal/ptr"
)

const (
	// Discord's highest user limit for voice channels.
	maxVoiceUserLimit = 99

	renameInputID = "channel_name"
	limitInputID  = "user_limit"
)

// voiceRoomPanel handles the management panel posted in every voice room (see common.VoiceRoomPanel).
type voiceRoomPanel struct {
	db *database.Database
}

func newVoiceRoomPanel(db *database.Database) *voiceRoomPanel {
	return &voiceRoomPanel{db}
}

func (p *voiceRoomPanel) Register(r handler.Router) {
	r.Group(func(r handler.Router) {
		r.Use(handlers.GuildOnly)

		// anyone in the room can reclaim it, as long as they created it.
		r.ButtonComponent(common.VoiceRoomReclaimID, p.reclaim)

		r.Group(func(r handler.Router) {
			r.Use(p.requireOwner)

			r.ButtonComponent(common.VoiceRoomRenameID, p.rename)
			r.Modal(common.VoiceRoomRenameSubmitID, p.renameSubmit)

			r.ButtonComponent(common.VoiceRoomLimitID, p.adjustLimit)
			r.Modal(common.VoiceRoomLimitSubmitID, p.adjustLimitSubmit)

			r.ButtonComponent(common.VoiceRoomToggleLockID, p.toggleLock)
			r.ButtonComponent(common.VoiceRoomCloseID, p.close)
		})
	})
}

// activeRoom returns the voice room in a channel, along with its lobby's settings.
func (p *voiceRoomPanel) activeRoom(ctx context.Context, guildID, channelID snowflake.ID) (gen.GuildActiveVoiceRoom, gen.GuildVoiceRoomsSetting, error) {
	room, err := p.db.VoiceRooms.GetRoom(ctx, guildID, channelID)
	if err != nil {
		if errors.Is(err, database.ErrVoiceRoomNotFound) {
			return room, gen.GuildVoiceRoomsSetting{}, disgox.WrapUserError(err, "This is not an active voice room.")
		}

		return room, gen.GuildVoiceRoomsSetting{}, err
	}

	lobby, err := p.db.VoiceRooms.GetLobby(ctx, guildID, room.OriginChannelID)
	if err != nil {
		if errors.Is(err, database.ErrVoiceRoomLobbyNotFound) {
			return room, lobby, disgox.WrapUserError(err, "The lobby this voice room was created from no longer exists.")
		}

		return room, lobby, err
	}

	return room, lobby, nil
}

type ownedRoomKey struct{}

// ownedRoom is a voice room and its lobby's settings, looked up by requireOwner.
type ownedRoom struct {
	room  gen.GuildActiveVoiceRoom
	lobby gen.GuildVoiceRoomsSetting
}

// requireOwner is middleware that only lets the voice room's current owner through. The room and
// its lobby are passed on to the handler in its context; get them with roomFromCtx.
func (p *voiceRoomPanel) requireOwner(next handler.Handler) handler.Handler {
	return func(e *handler.InteractionEvent) error {
		room, lobby, err := p.activeRoom(e.Ctx, *e.Interaction.GuildID(), e.Interaction.Channel().ID())
		if err != nil {
			return err
		}

		if room.CurrentOwnerID != e.User().ID {
			return disgox.UserErrorf("You do not have permission to manage this voice room.")
		}

		e.Ctx = context.WithValue(e.Ctx, ownedRoomKey{}, ownedRoom{room, lobby})
		return next(e)
	}
}

// roomFromCtx returns the voice room and lobby requireOwner looked up for this interaction.
func roomFromCtx(ctx context.Context) (gen.GuildActiveVoiceRoom, gen.GuildVoiceRoomsSetting) {
	owned := ctx.Value(ownedRoomKey{}).(ownedRoom)
	return owned.room, owned.lobby
}

// updatePanel replaces the panel on the message the button was clicked on, then confirms the action.
// The interaction must already be deferred with DeferUpdateMessage.
func (p *voiceRoomPanel) updatePanel(e *handler.ComponentEvent, room gen.GuildActiveVoiceRoom, lobby gen.GuildVoiceRoomsSetting, confirmation string) error {
	if _, err := e.UpdateInteractionResponse(discord.NewMessageUpdate().
		WithIsComponentsV2(true).
		WithComponents(common.VoiceRoomPanel(room, lobby)),
	); err != nil {
		return err
	}

	_, err := e.CreateFollowupMessage(discord.MessageCreate{
		Content: confirmation,
		Flags:   discord.MessageFlagEphemeral,
	})
	return err
}

func (p *voiceRoomPanel) rename(_ discord.ButtonInteractionData, e *handler.ComponentEvent) error {
	_, lobby := roomFromCtx(e.Ctx)
	if !lobby.CanRename {
		return disgox.UserErrorf("This voice room cannot be renamed.")
	}

	input := discord.NewShortTextInput(renameInputID).
		WithMaxLength(50).
		WithRequired(true)

	if channel, ok := e.Client().Caches.Channel(e.Channel().ID()); ok {
		input = input.WithValue(channel.Name())
	}

	return e.Modal(discord.NewModalCreate(common.VoiceRoomRenameSubmitID, "Rename Voice Room").
		AddLabel("New Channel Name", input))
}

func (p *voiceRoomPanel) renameSubmit(e *handler.ModalEvent) error {
	name := strings.TrimSpace(e.Data.Text(renameInputID))
	if name == "" {
		return disgox.UserErrorf("The name cannot be empty.")
	}

	// renaming channels is heavily rate limited, so this can take a while.
	if err := e.DeferCreateMessage(true); err != nil {
		return err
	}

	if _, err := e.Client().Rest.UpdateChannel(e.Channel().ID(), discord.GuildVoiceChannelUpdate{Name: &name},
		rest.WithReason(fmt.Sprintf("Automated Action - Voice room renamed by %s.", e.User().Tag())),
	); err != nil {
		return err
	}

	_, err := e.CreateFollowupMessage(discord.MessageCreate{
		Content: fmt.Sprintf("The name of the voice room has been set to `%s`.", name),
	})
	return err
}

func (p *voiceRoomPanel) adjustLimit(_ discord.ButtonInteractionData, e *handler.ComponentEvent) error {
	_, lobby := roomFromCtx(e.Ctx)
	if !lobby.CanAdjustLimit {
		return disgox.UserErrorf("The limit of this voice room cannot be adjusted.")
	}

	input := discord.NewShortTextInput(limitInputID).
		WithPlaceholder(fmt.Sprintf("Between 2 and %d.", maxRoomLimit(lobby))).
		WithMaxLength(2).
		WithRequired(true)

	return e.Modal(discord.NewModalCreate(common.VoiceRoomLimitSubmitID, "Adjust Voice Room Limit").
		AddLabel("User Limit", input))
}

func (p *voiceRoomPanel) adjustLimitSubmit(e *handler.ModalEvent) error {
	limit, err := strconv.Atoi(strings.TrimSpace(e.Data.Text(limitInputID)))
	if err != nil {
		return disgox.UserErrorf("The limit must be a number.")
	}

	if err := e.DeferCreateMessage(true); err != nil {
		return err
	}

	room, lobby := roomFromCtx(e.Ctx)
	if ptr.Value(room.IsLocked) {
		return disgox.UserErrorf("This voice room is locked, please unlock it before adjusting the limit.")
	}

	if limit <= 1 {
		return disgox.UserErrorf(`The limit must be more than 1. If you want to lock the voice room, use the "Toggle Locked" button instead.`)
	}

	if maxLimit := maxRoomLimit(lobby); limit > maxLimit {
		return disgox.UserErrorf("The limit cannot be more than the max limit of `%d`.", maxLimit)
	}

	if _, err := e.Client().Rest.UpdateChannel(e.Channel().ID(), discord.GuildVoiceChannelUpdate{UserLimit: &limit}); err != nil {
		return err
	}

	_, err = e.CreateFollowupMessage(discord.MessageCreate{
		Content: fmt.Sprintf("The limit of the voice room has been set to `%d`.", limit),
	})
	return err
}

func (p *voiceRoomPanel) toggleLock(_ discord.ButtonInteractionData, e *handler.ComponentEvent) error {
	if err := e.DeferUpdateMessage(); err != nil {
		return err
	}

	room, lobby := roomFromCtx(e.Ctx)
	if !lobby.CanLock {
		return disgox.UserErrorf("This voice room cannot be locked.")
	}

	locked := !ptr.Value(room.IsLocked)

	// locking is done by setting the user limit to 1, unlocking restores the lobby's limit.
	// The channel is updated first, so a failure doesn't leave the room marked as locked.
	limit := int(lobby.UserLimit)
	if locked {
		limit = 1
	}

	if _, err := e.Client().Rest.UpdateChannel(room.ChannelID, discord.GuildVoiceChannelUpdate{UserLimit: &limit}); err != nil {
		return err
	}

	room, err := p.db.VoiceRooms.UpdateRoom(e.Ctx, room.GuildID, room.ChannelID, database.UpdateVoiceRoomOpts{IsLocked: &locked})
	if err != nil {
		return err
	}

	state := "unlocked"
	if locked {
		state = "locked"
	}

	return p.updatePanel(e, room, lobby, fmt.Sprintf("The voice room has been %s.", state))
}

func (p *voiceRoomPanel) reclaim(_ discord.ButtonInteractionData, e *handler.ComponentEvent) error {
	if err := e.DeferUpdateMessage(); err != nil {
		return err
	}

	room, lobby, err := p.activeRoom(e.Ctx, *e.GuildID(), e.Channel().ID())
	if err != nil {
		return err
	}

	userID := e.User().ID
	if room.CreatedByUserID != userID {
		return disgox.UserErrorf("Only the creator of this voice room can reclaim its ownership.")
	}

	if room.CurrentOwnerID == userID {
		return disgox.UserErrorf("You already have control over this voice room.")
	}

	room, err = p.db.VoiceRooms.UpdateRoom(e.Ctx, room.GuildID, room.ChannelID, database.UpdateVoiceRoomOpts{CurrentOwnerID: &userID})
	if err != nil {
		return err
	}

	return p.updatePanel(e, room, lobby, "You have reclaimed the ownership of the voice room.")
}

func (p *voiceRoomPanel) close(_ discord.ButtonInteractionData, e *handler.ComponentEvent) error {
	if err := e.DeferUpdateMessage(); err != nil {
		return err
	}

	room, _ := roomFromCtx(e.Ctx)
	if err := p.db.VoiceRooms.DeleteRoom(e.Ctx, room.GuildID, room.ChannelID); err != nil {
		return err
	}

	if err := e.Client().Rest.DeleteChannel(room.ChannelID,
		rest.WithReason("Automated Action - Owner manually closed the voice room."),
	); err != nil {
		slog.Error("failed to delete closed voice room",
			slog.String("channel_id", room.ChannelID.String()),
			slog.Any("err", err),
		)
		return disgox.WrapUserError(err, "Something went wrong deleting the channel, contact the server admins to have it removed.")
	}

	return nil
}

// maxRoomLimit is the highest user limit a room from this lobby can be set to.
func maxRoomLimit(lobby gen.GuildVoiceRoomsSetting) int {
	if lobby.UserLimit <= 0 {
		return maxVoiceUserLimit
	}

	return int(lobby.UserLimit)
}
