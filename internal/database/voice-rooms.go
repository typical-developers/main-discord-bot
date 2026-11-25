package database

import (
	"context"
	"errors"

	"github.com/disgoorg/snowflake/v2"
	"github.com/jackc/pgx/v5"
	"github.com/typical-developers/main-discord-bot/internal/database/gen"
)

type voiceRooms struct {
	db *Database
}

func newVoiceRooms(db *Database) *voiceRooms {
	return &voiceRooms{db}
}

// VoiceRoomLobbySettings only applies the fields that are not nil.
// When creating a lobby, nil fields use the defaults (no user limit, nothing allowed).
type VoiceRoomLobbySettings struct {
	UserLimit      *int32
	CanRename      *bool
	CanLock        *bool
	CanAdjustLimit *bool
}

// UpdateVoiceRoomOpts only applies the fields that are not nil.
type UpdateVoiceRoomOpts struct {
	CurrentOwnerID *snowflake.ID
	IsLocked       *bool
}

// CreateLobby turns a voice channel into a lobby that creates voice rooms when joined.
func (v *voiceRooms) CreateLobby(ctx context.Context, guildID, channelID snowflake.ID, settings VoiceRoomLobbySettings) (gen.GuildVoiceRoomsSetting, error) {
	var lobby gen.GuildVoiceRoomsSetting

	err := v.db.WithTx(ctx, func(ctx context.Context, txDb *Database) error {
		// a voice room that was created by a lobby can't become a lobby itself.
		if _, err := txDb.VoiceRooms.GetRoom(ctx, guildID, channelID); err == nil {
			return ErrVoiceRoomLobbyIsVoiceRoom
		} else if !errors.Is(err, ErrVoiceRoomNotFound) {
			return err
		}

		var err error
		lobby, err = txDb.queries.CreateVoiceRoomLobby(ctx, txDb.dbtx, gen.CreateVoiceRoomLobbyParams{
			GuildID:        guildID,
			VoiceChannelID: channelID,
			UserLimit:      pgInt4(settings.UserLimit),
			CanRename:      pgBool(settings.CanRename),
			CanLock:        pgBool(settings.CanLock),
			CanAdjustLimit: pgBool(settings.CanAdjustLimit),
		})
		if err != nil {
			if pgErrorCode(err) == pgUniqueViolation {
				return ErrVoiceRoomLobbyExists
			}

			return err
		}

		return nil
	})
	if err != nil {
		return gen.GuildVoiceRoomsSetting{}, err
	}

	return lobby, nil
}

func (v *voiceRooms) GetLobby(ctx context.Context, guildID, channelID snowflake.ID) (gen.GuildVoiceRoomsSetting, error) {
	lobby, err := v.db.queries.GetVoiceRoomLobby(ctx, v.db.dbtx, gen.GetVoiceRoomLobbyParams{
		GuildID:        guildID,
		VoiceChannelID: channelID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return gen.GuildVoiceRoomsSetting{}, ErrVoiceRoomLobbyNotFound
		}

		return gen.GuildVoiceRoomsSetting{}, err
	}

	return lobby, nil
}

// GetLobbies returns every lobby in a guild, along with the IDs of the voice rooms each lobby has open.
func (v *voiceRooms) GetLobbies(ctx context.Context, guildID snowflake.ID) ([]gen.GetVoiceRoomLobbiesRow, error) {
	return v.db.queries.GetVoiceRoomLobbies(ctx, v.db.dbtx, guildID)
}

// GetLobbyRoomIDs returns the IDs of the voice rooms a lobby has open.
func (v *voiceRooms) GetLobbyRoomIDs(ctx context.Context, guildID, lobbyChannelID snowflake.ID) ([]snowflake.ID, error) {
	return v.db.queries.GetVoiceRoomIds(ctx, v.db.dbtx, gen.GetVoiceRoomIdsParams{
		GuildID:         guildID,
		OriginChannelID: lobbyChannelID,
	})
}

func (v *voiceRooms) UpdateLobby(ctx context.Context, guildID, channelID snowflake.ID, settings VoiceRoomLobbySettings) (gen.GuildVoiceRoomsSetting, error) {
	lobby, err := v.db.queries.UpdateVoiceRoomLobby(ctx, v.db.dbtx, gen.UpdateVoiceRoomLobbyParams{
		GuildID:        guildID,
		VoiceChannelID: channelID,
		UserLimit:      pgInt4(settings.UserLimit),
		CanRename:      pgBool(settings.CanRename),
		CanLock:        pgBool(settings.CanLock),
		CanAdjustLimit: pgBool(settings.CanAdjustLimit),
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return gen.GuildVoiceRoomsSetting{}, ErrVoiceRoomLobbyNotFound
		}

		return gen.GuildVoiceRoomsSetting{}, err
	}

	return lobby, nil
}

// DeleteLobby deletes a lobby. Voice rooms the lobby has open are left alone.
func (v *voiceRooms) DeleteLobby(ctx context.Context, guildID, channelID snowflake.ID) error {
	affected, err := v.db.queries.DeleteVoiceRoomLobby(ctx, v.db.dbtx, gen.DeleteVoiceRoomLobbyParams{
		GuildID:        guildID,
		VoiceChannelID: channelID,
	})
	if err != nil {
		return err
	}

	if affected == 0 {
		return ErrVoiceRoomLobbyNotFound
	}

	return nil
}

// RegisterRoom registers a voice room that was created from a lobby. The creator is the room's first owner.
func (v *voiceRooms) RegisterRoom(ctx context.Context, guildID, lobbyChannelID, channelID, creatorID snowflake.ID) (gen.GuildActiveVoiceRoom, error) {
	var room gen.GuildActiveVoiceRoom

	err := v.db.WithTx(ctx, func(ctx context.Context, txDb *Database) error {
		if _, err := txDb.VoiceRooms.GetLobby(ctx, guildID, lobbyChannelID); err != nil {
			return err
		}

		var err error
		room, err = txDb.queries.RegisterVoiceRoom(ctx, txDb.dbtx, gen.RegisterVoiceRoomParams{
			GuildID:         guildID,
			OriginChannelID: lobbyChannelID,
			ChannelID:       channelID,
			CreatedByUserID: creatorID,
			CurrentOwnerID:  creatorID,
		})
		if err != nil {
			if pgErrorCode(err) == pgUniqueViolation {
				return ErrVoiceRoomExists
			}

			return err
		}

		return nil
	})
	if err != nil {
		return gen.GuildActiveVoiceRoom{}, err
	}

	return room, nil
}

func (v *voiceRooms) GetRoom(ctx context.Context, guildID, channelID snowflake.ID) (gen.GuildActiveVoiceRoom, error) {
	room, err := v.db.queries.GetVoiceRoom(ctx, v.db.dbtx, gen.GetVoiceRoomParams{
		GuildID:   guildID,
		ChannelID: channelID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return gen.GuildActiveVoiceRoom{}, ErrVoiceRoomNotFound
		}

		return gen.GuildActiveVoiceRoom{}, err
	}

	return room, nil
}

// GetRooms returns every voice room a lobby has open.
func (v *voiceRooms) GetRooms(ctx context.Context, guildID, lobbyChannelID snowflake.ID) ([]gen.GuildActiveVoiceRoom, error) {
	return v.db.queries.GetVoiceRooms(ctx, v.db.dbtx, gen.GetVoiceRoomsParams{
		GuildID:         guildID,
		OriginChannelID: lobbyChannelID,
	})
}

func (v *voiceRooms) UpdateRoom(ctx context.Context, guildID, channelID snowflake.ID, opts UpdateVoiceRoomOpts) (gen.GuildActiveVoiceRoom, error) {
	room, err := v.db.queries.UpdateVoiceRoom(ctx, v.db.dbtx, gen.UpdateVoiceRoomParams{
		GuildID:        guildID,
		ChannelID:      channelID,
		CurrentOwnerID: opts.CurrentOwnerID,
		IsLocked:       pgBool(opts.IsLocked),
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return gen.GuildActiveVoiceRoom{}, ErrVoiceRoomNotFound
		}

		return gen.GuildActiveVoiceRoom{}, err
	}

	return room, nil
}

func (v *voiceRooms) DeleteRoom(ctx context.Context, guildID, channelID snowflake.ID) error {
	affected, err := v.db.queries.DeleteVoiceRoom(ctx, v.db.dbtx, gen.DeleteVoiceRoomParams{
		GuildID:   guildID,
		ChannelID: channelID,
	})
	if err != nil {
		return err
	}

	if affected == 0 {
		return ErrVoiceRoomNotFound
	}

	return nil
}
