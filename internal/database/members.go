package database

import (
	"context"
	"errors"

	"github.com/disgoorg/snowflake/v2"
	"github.com/jackc/pgx/v5"
	"github.com/typical-developers/main-discord-bot/internal/database/gen"
)

type members struct {
	db *Database
}

func newMembers(db *Database) *members {
	return &members{db}
}

func (m *members) CreateProfile(ctx context.Context, guildID, memberID snowflake.ID) (gen.GuildProfile, error) {
	profile, err := m.db.queries.CreateMemberProfile(ctx, m.db.dbtx, gen.CreateMemberProfileParams{
		GuildID:  guildID,
		MemberID: memberID,
	})
	if err != nil {
		if pgErrorCode(err) == pgUniqueViolation {
			return gen.GuildProfile{}, ErrMemberProfileExists
		}

		return gen.GuildProfile{}, err
	}

	return profile, nil
}

// GetProfile returns the member's profile along with their all-time chat and voice rank.
func (m *members) GetProfile(ctx context.Context, guildID, memberID snowflake.ID) (gen.GetMemberProfileRow, error) {
	profile, err := m.db.queries.GetMemberProfile(ctx, m.db.dbtx, gen.GetMemberProfileParams{
		GuildID:  guildID,
		MemberID: memberID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return gen.GetMemberProfileRow{}, ErrMemberProfileNotFound
		}

		return gen.GetMemberProfileRow{}, err
	}

	return profile, nil
}

// GetActivityRoleInfo returns the activity roles a member has earned with the given amount of points,
// the highest role they have earned and the next role they can earn.
//
// CurrentRoleID and NextRoleID are nil when there is no current or next role.
func (m *members) GetActivityRoleInfo(ctx context.Context, guildID snowflake.ID, activityType ActivityType, points int32) (gen.GetMemberActivityRoleInfoRow, error) {
	if !activityType.Valid() {
		return gen.GetMemberActivityRoleInfoRow{}, ErrInvalidActivityType
	}

	return m.db.queries.GetMemberActivityRoleInfo(ctx, m.db.dbtx, gen.GetMemberActivityRoleInfoParams{
		GuildID:   guildID,
		GrantType: string(activityType),
		Points:    points,
	})
}

// GrantActivityPoints grants the guild's configured amount of activity points to the member,
// and adds them to the activity grant log that the daily, weekly, monthly and yearly leaderboards are built from.
//
// The cooldown is checked in the same statement that grants the points,
// so concurrent grants for the same member can't both succeed.
func (m *members) GrantActivityPoints(ctx context.Context, guildID, memberID snowflake.ID, activityType ActivityType) (gen.GuildProfile, error) {
	var profile gen.GuildProfile

	err := m.db.WithTx(ctx, func(ctx context.Context, txDb *Database) error {
		settings, err := txDb.Guilds.GetActivitySettings(ctx, guildID, activityType)
		if err != nil {
			return err
		}

		if !settings.IsEnabled {
			return ErrActivityTrackingDisabled
		}

		switch activityType {
		case ActivityTypeChat:
			profile, err = txDb.queries.IncrementMemberChatActivity(ctx, txDb.dbtx, gen.IncrementMemberChatActivityParams{
				GuildID:         guildID,
				MemberID:        memberID,
				Points:          settings.GrantAmount,
				CooldownSeconds: settings.GrantCooldown,
			})
		case ActivityTypeVoice:
			profile, err = txDb.queries.IncrementMemberVoiceActivity(ctx, txDb.dbtx, gen.IncrementMemberVoiceActivityParams{
				GuildID:         guildID,
				MemberID:        memberID,
				Points:          settings.GrantAmount,
				CooldownSeconds: settings.GrantCooldown,
			})
		}

		if err != nil {
			if !errors.Is(err, pgx.ErrNoRows) {
				return err
			}

			// no rows means the profile doesn't exist or the member is on cooldown.
			exists, err := txDb.queries.MemberProfileExists(ctx, txDb.dbtx, gen.MemberProfileExistsParams{
				GuildID:  guildID,
				MemberID: memberID,
			})
			if err != nil {
				return err
			}
			if !exists {
				return ErrMemberProfileNotFound
			}

			return ErrMemberOnGrantCooldown
		}

		return txDb.queries.LogActivityGrant(ctx, txDb.dbtx, gen.LogActivityGrantParams{
			GuildID:      guildID,
			MemberID:     memberID,
			GrantType:    string(activityType),
			EarnedPoints: settings.GrantAmount,
		})
	})
	if err != nil {
		return gen.GuildProfile{}, err
	}

	return profile, nil
}

// ProfileMigration is the result of MigrateProfile.
type ProfileMigration struct {
	// From is the old member's profile as it was before the migration reset it.
	From gen.GuildProfile
	// To is the new member's profile after the old profile's points were added to it.
	To gen.GuildProfile
}

// MigrateProfile moves a member's profile to another member (for example, an alt account).
//
// If the other member already has a profile, the points are added together, the card style is
// taken from the old profile and the latest grant times are kept. The old profile is reset to its defaults.
// Points in the activity grant log (daily, weekly, monthly and yearly leaderboards) are not moved.
//
// The old profile is locked for the whole transaction, so points granted to it while the
// migration runs are either moved with it or wait until it has been reset.
func (m *members) MigrateProfile(ctx context.Context, guildID, fromMemberID, toMemberID snowflake.ID) (ProfileMigration, error) {
	if fromMemberID == toMemberID {
		return ProfileMigration{}, ErrMemberProfileMigrateSelf
	}

	var migration ProfileMigration

	err := m.db.WithTx(ctx, func(ctx context.Context, txDb *Database) error {
		from, err := txDb.queries.GetMemberProfileForUpdate(ctx, txDb.dbtx, gen.GetMemberProfileForUpdateParams{
			GuildID:  guildID,
			MemberID: fromMemberID,
		})
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrMemberProfileNotFound
			}

			return err
		}

		to, err := txDb.queries.MigrateMemberProfile(ctx, txDb.dbtx, gen.MigrateMemberProfileParams{
			GuildID:    guildID,
			ToMemberID: toMemberID,
			CardStyle:  from.CardStyle,

			ChatActivity:          from.ChatActivity,
			LastChatActivityGrant: from.LastChatActivityGrant,

			VoiceActivity:          from.VoiceActivity,
			LastVoiceActivityGrant: from.LastVoiceActivityGrant,
		})
		if err != nil {
			return err
		}

		if err := txDb.Members.ResetProfile(ctx, guildID, fromMemberID); err != nil {
			return err
		}

		migration = ProfileMigration{From: from, To: to}
		return nil
	})
	if err != nil {
		return ProfileMigration{}, err
	}

	return migration, nil
}

// ResetProfile resets a member's card style, points and grant times to their defaults.
func (m *members) ResetProfile(ctx context.Context, guildID, memberID snowflake.ID) error {
	return m.db.queries.ResetMemberProfile(ctx, m.db.dbtx, gen.ResetMemberProfileParams{
		GuildID:  guildID,
		MemberID: memberID,
	})
}
