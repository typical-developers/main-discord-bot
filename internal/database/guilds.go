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
// An empty, non-nil DenyRoles clears the denied roles.
type UpdateActivitySettingsOpts struct {
	IsEnabled     *bool
	GrantAmount   *int32
	GrantCooldown *int32
	DenyRoles     []snowflake.ID
}

// MessageEmbedSettings are all of a guild's message embed settings.
type MessageEmbedSettings struct {
	IsEnabled        bool
	DisabledChannels []snowflake.ID
	IgnoredChannels  []snowflake.ID
	IgnoredRoles     []snowflake.ID
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

// EnsureRegistered registers the guild if it isn't registered yet.
func (g *guilds) EnsureRegistered(ctx context.Context, guildID snowflake.ID) error {
	if _, err := g.Register(ctx, guildID); err != nil && !errors.Is(err, ErrGuildAlreadyRegistered) {
		return err
	}

	return nil
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
			IsEnabled:     opts.IsEnabled,
			GrantAmount:   opts.GrantAmount,
			GrantCooldown: opts.GrantCooldown,
			DenyRoles:     opts.DenyRoles,
		})
	case ActivityTypeVoice:
		affected, err = g.db.queries.UpdateGuildVoiceActivitySettings(ctx, g.db.dbtx, gen.UpdateGuildVoiceActivitySettingsParams{
			GuildID:       guildID,
			IsEnabled:     opts.IsEnabled,
			GrantAmount:   opts.GrantAmount,
			GrantCooldown: opts.GrantCooldown,
			DenyRoles:     opts.DenyRoles,
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

// UpdateActivityRole changes how many points are required to be given an activity role.
func (g *guilds) UpdateActivityRole(ctx context.Context, guildID, roleID snowflake.ID, requiredPoints int32) error {
	affected, err := g.db.queries.UpdateActivityRole(ctx, g.db.dbtx, gen.UpdateActivityRoleParams{
		GuildID:        guildID,
		RoleID:         roleID,
		RequiredPoints: requiredPoints,
	})
	if err != nil {
		return err
	}

	if affected == 0 {
		return ErrActivityRoleNotFound
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

// SetMessageEmbedSettings replaces all of the guild's message embed settings.
func (g *guilds) SetMessageEmbedSettings(ctx context.Context, guildID snowflake.ID, settings MessageEmbedSettings) error {
	affected, err := g.db.queries.SetGuildMessageEmbedSettings(ctx, g.db.dbtx, gen.SetGuildMessageEmbedSettingsParams{
		GuildID:          guildID,
		IsEnabled:        settings.IsEnabled,
		DisabledChannels: nonNilIDs(settings.DisabledChannels),
		IgnoredChannels:  nonNilIDs(settings.IgnoredChannels),
		IgnoredRoles:     nonNilIDs(settings.IgnoredRoles),
	})
	if err != nil {
		return err
	}

	if affected == 0 {
		return ErrGuildNotFound
	}

	return nil
}

// nonNilIDs returns an empty slice for nil, since a nil slice is sent to the database as NULL.
func nonNilIDs(ids []snowflake.ID) []snowflake.ID {
	if ids == nil {
		return []snowflake.ID{}
	}

	return ids
}
