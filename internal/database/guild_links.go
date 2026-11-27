package database

import (
	"context"
	"errors"

	"github.com/disgoorg/snowflake/v2"
	"github.com/jackc/pgx/v5"
	"github.com/typical-developers/main-discord-bot/internal/database/gen"
)

// Linked guilds share their members' all time activity points: the all time leaderboard, the points
// and rank on profile cards, and activity role requirements are added up across every guild in the
// group. Profiles, cooldowns, the activity grant log and the daily, weekly, monthly and yearly
// leaderboards are still kept per guild.

// LinkGuilds links two guilds so their members' activity points count towards each other.
//
// If either guild is already linked to others, the other guild joins its group, and if both are
// in different groups the groups are merged. Every guild in the resulting group is linked to every other.
func (g *guilds) LinkGuilds(ctx context.Context, guildID, otherGuildID snowflake.ID) error {
	if guildID == otherGuildID {
		return ErrGuildLinkSelf
	}

	return g.db.WithTx(ctx, func(ctx context.Context, txDb *Database) error {
		if err := txDb.queries.LockGuildLinks(ctx, txDb.dbtx); err != nil {
			return err
		}

		groupID, linked, err := txDb.Guilds.linkGroup(ctx, guildID)
		if err != nil {
			return err
		}

		otherGroupID, otherLinked, err := txDb.Guilds.linkGroup(ctx, otherGuildID)
		if err != nil {
			return err
		}

		switch {
		case linked && otherLinked && groupID == otherGroupID:
			return ErrGuildsAlreadyLinked

		case linked && otherLinked:
			// both are already linked to other guilds, so their groups become one.
			if err := txDb.queries.MergeGuildLinkGroups(ctx, txDb.dbtx, gen.MergeGuildLinkGroupsParams{
				IntoGroupID: groupID,
				FromGroupID: otherGroupID,
			}); err != nil {
				return err
			}

			return txDb.queries.DeleteGuildLinkGroup(ctx, txDb.dbtx, otherGroupID)

		case linked:
			return txDb.Guilds.addLink(ctx, otherGuildID, groupID)

		case otherLinked:
			return txDb.Guilds.addLink(ctx, guildID, otherGroupID)

		default:
			groupID, err := txDb.queries.CreateGuildLinkGroup(ctx, txDb.dbtx)
			if err != nil {
				return err
			}

			if err := txDb.Guilds.addLink(ctx, guildID, groupID); err != nil {
				return err
			}

			return txDb.Guilds.addLink(ctx, otherGuildID, groupID)
		}
	})
}

// UnlinkGuild removes a guild from the guilds it's linked to. The other guilds stay linked to each other.
// Points earned in each guild stay in that guild's profiles, so they stop counting towards each other.
func (g *guilds) UnlinkGuild(ctx context.Context, guildID snowflake.ID) error {
	return g.db.WithTx(ctx, func(ctx context.Context, txDb *Database) error {
		if err := txDb.queries.LockGuildLinks(ctx, txDb.dbtx); err != nil {
			return err
		}

		groupID, err := txDb.queries.DeleteGuildLink(ctx, txDb.dbtx, guildID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrGuildNotLinked
			}

			return err
		}

		remaining, err := txDb.queries.CountGuildLinkGroupGuilds(ctx, txDb.dbtx, groupID)
		if err != nil {
			return err
		}

		// a guild on its own isn't linked to anything anymore.
		if remaining <= 1 {
			return txDb.queries.DeleteGuildLinkGroup(ctx, txDb.dbtx, groupID)
		}

		return nil
	})
}

// GetLinkedGuilds returns the other guilds linked to a guild, in the order they were linked.
// It's empty when the guild isn't linked.
func (g *guilds) GetLinkedGuilds(ctx context.Context, guildID snowflake.ID) ([]gen.GetLinkedGuildsRow, error) {
	return g.db.queries.GetLinkedGuilds(ctx, g.db.dbtx, guildID)
}

// linkGroup returns the group a guild is in, and false when it isn't linked.
func (g *guilds) linkGroup(ctx context.Context, guildID snowflake.ID) (int64, bool, error) {
	groupID, err := g.db.queries.GetGuildLinkGroup(ctx, g.db.dbtx, guildID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, false, nil
		}

		return 0, false, err
	}

	return groupID, true, nil
}

func (g *guilds) addLink(ctx context.Context, guildID snowflake.ID, groupID int64) error {
	if err := g.db.queries.AddGuildLink(ctx, g.db.dbtx, gen.AddGuildLinkParams{
		GuildID: guildID,
		GroupID: groupID,
	}); err != nil {
		if pgErrorCode(err) == pgForeignKeyViolation {
			return ErrGuildNotFound
		}

		return err
	}

	return nil
}
