package database

import (
	"context"
	"errors"

	"github.com/disgoorg/snowflake/v2"
	"github.com/jackc/pgx/v5"
	"github.com/typical-developers/main-discord-bot/internal/database/gen"
)

type guilds struct {
	db *Database
}

func newGuilds(db *Database) *guilds {
	return &guilds{db}
}

type ActivitySettings struct {
	IsEnabled     bool
	GrantAmount   int32
	GrantCooldown int32
	DenyRoles     []snowflake.ID
}

// UpdateActivitySettingsOpts only updates the fields that are not nil.
type UpdateActivitySettingsOpts struct {
	IsEnabled     *bool
	GrantAmount   *int32
	GrantCooldown *int32
}

// UpdateMessageEmbedSettingsOpts only applies the fields that are not nil.
type UpdateMessageEmbedSettingsOpts struct {
	IsEnabled *bool

	AddDisabledChannel    *snowflake.ID
	RemoveDisabledChannel *snowflake.ID
	AddIgnoredChannel     *snowflake.ID
	RemoveIgnoredChannel  *snowflake.ID
	AddIgnoredRole        *snowflake.ID
	RemoveIgnoredRole     *snowflake.ID
}

// Register registers a guild.
// Chat activity, voice activity and message embed settings are created by a database trigger.
func (g *guilds) Register(ctx context.Context, guildID snowflake.ID) (gen.Guild, error) {
	guild, err := g.db.queries.RegisterGuild(ctx, g.db.dbtx, guildID)
	if err != nil {
		if pgErrorCode(err) == pgUniqueViolation {
			return gen.Guild{}, ErrGuildAlreadyRegistered
		}

		return gen.Guild{}, err
	}

	return guild, nil
}

func (g *guilds) GetActivitySettings(ctx context.Context, guildID snowflake.ID, activityType ActivityType) (ActivitySettings, error) {
	var (
		settings ActivitySettings
		err      error
	)

	switch activityType {
	case ActivityTypeChat:
		var row gen.GetGuildChatActivitySettingsRow
		row, err = g.db.queries.GetGuildChatActivitySettings(ctx, g.db.dbtx, guildID)
		settings = ActivitySettings{
			IsEnabled:     row.IsEnabled,
			GrantAmount:   row.GrantAmount,
			GrantCooldown: row.GrantCooldown,
			DenyRoles:     row.DenyRoles,
		}
	case ActivityTypeVoice:
		var row gen.GetGuildVoiceActivitySettingsRow
		row, err = g.db.queries.GetGuildVoiceActivitySettings(ctx, g.db.dbtx, guildID)
		settings = ActivitySettings{
			IsEnabled:     row.IsEnabled,
			GrantAmount:   row.GrantAmount,
			GrantCooldown: row.GrantCooldown,
			DenyRoles:     row.DenyRoles,
		}
	default:
		return ActivitySettings{}, ErrInvalidActivityType
	}

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ActivitySettings{}, ErrGuildNotFound
		}

		return ActivitySettings{}, err
	}

	return settings, nil
}

func (g *guilds) UpdateActivitySettings(ctx context.Context, guildID snowflake.ID, activityType ActivityType, opts UpdateActivitySettingsOpts) error {
	var (
		affected int64
		err      error
	)

	switch activityType {
	case ActivityTypeChat:
		affected, err = g.db.queries.UpdateGuildChatActivitySettings(ctx, g.db.dbtx, gen.UpdateGuildChatActivitySettingsParams{
			GuildID:       guildID,
			IsEnabled:     pgBool(opts.IsEnabled),
			GrantAmount:   pgInt4(opts.GrantAmount),
			GrantCooldown: pgInt4(opts.GrantCooldown),
		})
	case ActivityTypeVoice:
		affected, err = g.db.queries.UpdateGuildVoiceActivitySettings(ctx, g.db.dbtx, gen.UpdateGuildVoiceActivitySettingsParams{
			GuildID:       guildID,
			IsEnabled:     pgBool(opts.IsEnabled),
			GrantAmount:   pgInt4(opts.GrantAmount),
			GrantCooldown: pgInt4(opts.GrantCooldown),
		})
	default:
		return ErrInvalidActivityType
	}

	if err != nil {
		return err
	}

	if affected == 0 {
		return ErrGuildNotFound
	}

	return nil
}

// GetActivityRoles returns the activity roles for a guild, ordered by required points (lowest first).
func (g *guilds) GetActivityRoles(ctx context.Context, guildID snowflake.ID, activityType ActivityType) ([]gen.GetGuildActivityRolesRow, error) {
	if !activityType.Valid() {
		return nil, ErrInvalidActivityType
	}

	return g.db.queries.GetGuildActivityRoles(ctx, g.db.dbtx, gen.GetGuildActivityRolesParams{
		GuildID:   guildID,
		GrantType: string(activityType),
	})
}

func (g *guilds) CreateActivityRole(ctx context.Context, guildID snowflake.ID, activityType ActivityType, roleID snowflake.ID, requiredPoints int32) error {
	if !activityType.Valid() {
		return ErrInvalidActivityType
	}

	if err := g.db.queries.InsertActivityRole(ctx, g.db.dbtx, gen.InsertActivityRoleParams{
		GuildID:        guildID,
		GrantType:      string(activityType),
		RoleID:         roleID,
		RequiredPoints: requiredPoints,
	}); err != nil {
		switch pgErrorCode(err) {
		case pgUniqueViolation:
			return ErrActivityRoleExists
		case pgForeignKeyViolation:
			return ErrGuildNotFound
		}

		return err
	}

	return nil
}

func (g *guilds) DeleteActivityRole(ctx context.Context, guildID, roleID snowflake.ID) error {
	affected, err := g.db.queries.DeleteActivityRole(ctx, g.db.dbtx, gen.DeleteActivityRoleParams{
		GuildID: guildID,
		RoleID:  roleID,
	})
	if err != nil {
		return err
	}

	if affected == 0 {
		return ErrActivityRoleNotFound
	}

	return nil
}

func (g *guilds) GetMessageEmbedSettings(ctx context.Context, guildID snowflake.ID) (gen.GetGuildMessageEmbedSettingsRow, error) {
	settings, err := g.db.queries.GetGuildMessageEmbedSettings(ctx, g.db.dbtx, guildID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return gen.GetGuildMessageEmbedSettingsRow{}, ErrGuildNotFound
		}

		return gen.GetGuildMessageEmbedSettingsRow{}, err
	}

	return settings, nil
}

// UpdateMessageEmbedSettings applies all of the changes in a single transaction.
// IDs are added before they are removed, so passing the same ID to both leaves it removed.
func (g *guilds) UpdateMessageEmbedSettings(ctx context.Context, guildID snowflake.ID, opts UpdateMessageEmbedSettingsOpts) error {
	return g.db.WithTx(ctx, func(ctx context.Context, txDb *Database) error {
		// ensures ErrGuildNotFound is returned even when there is nothing to change.
		if _, err := txDb.Guilds.GetMessageEmbedSettings(ctx, guildID); err != nil {
			return err
		}

		if opts.IsEnabled != nil {
			if _, err := txDb.queries.UpdateGuildMessageEmbedSettings(ctx, txDb.dbtx, gen.UpdateGuildMessageEmbedSettingsParams{
				GuildID:   guildID,
				IsEnabled: pgBool(opts.IsEnabled),
			}); err != nil {
				return err
			}
		}

		if opts.AddDisabledChannel != nil || opts.AddIgnoredChannel != nil || opts.AddIgnoredRole != nil {
			if _, err := txDb.queries.AppendGuildMessageEmbedSettingsArrays(ctx, txDb.dbtx, gen.AppendGuildMessageEmbedSettingsArraysParams{
				GuildID:           guildID,
				DisabledChannelID: opts.AddDisabledChannel,
				IgnoredChannelID:  opts.AddIgnoredChannel,
				IgnoredRoleID:     opts.AddIgnoredRole,
			}); err != nil {
				return err
			}
		}

		if opts.RemoveDisabledChannel != nil || opts.RemoveIgnoredChannel != nil || opts.RemoveIgnoredRole != nil {
			if _, err := txDb.queries.RemoveGuildMessageEmbedSettingsArrays(ctx, txDb.dbtx, gen.RemoveGuildMessageEmbedSettingsArraysParams{
				GuildID:           guildID,
				DisabledChannelID: opts.RemoveDisabledChannel,
				IgnoredChannelID:  opts.RemoveIgnoredChannel,
				IgnoredRoleID:     opts.RemoveIgnoredRole,
			}); err != nil {
				return err
			}
		}

		return nil
	})
}
