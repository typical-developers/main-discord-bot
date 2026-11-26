package database

import (
	"context"

	"github.com/disgoorg/snowflake/v2"
	"github.com/typical-developers/main-discord-bot/internal/database/gen"
)

type leaderboards struct {
	db *Database
}

func newLeaderboards(db *Database) *leaderboards {
	return &leaderboards{db}
}

type LeaderboardEntry struct {
	Rank     int64
	MemberID snowflake.ID
	Points   int32
}

type LeaderboardPage struct {
	// The page that was returned. This is 1 when the requested page was out of range.
	Page       int32
	TotalPages int32
	Entries    []LeaderboardEntry
}

// GetPage returns a page of a guild's activity leaderboard. Pages start at 1.
// Requesting a page that doesn't exist returns the first page.
//
// Leaderboards other than all time are only as current as the last Refresh, which the workers run.
func (l *leaderboards) GetPage(ctx context.Context, guildID snowflake.ID, activityType ActivityType, period TimePeriod, page, perPage int32) (LeaderboardPage, error) {
	if !activityType.Valid() {
		return LeaderboardPage{}, ErrInvalidActivityType
	}

	if perPage <= 0 {
		perPage = 15
	}

	var (
		totalPages int32
		err        error
	)

	switch period {
	case TimePeriodAllTime:
		totalPages, err = l.db.queries.GetAllTimeActivityLeaderboardPages(ctx, l.db.dbtx, gen.GetAllTimeActivityLeaderboardPagesParams{
			GuildID: guildID,
			LimitBy: perPage,
		})
	case TimePeriodDaily, TimePeriodWeekly, TimePeriodMonthly, TimePeriodYearly:
		totalPages, err = l.db.queries.GetActivityLeaderboardPages(ctx, l.db.dbtx, gen.GetActivityLeaderboardPagesParams{
			GuildID:   guildID,
			GrantType: string(activityType),
			Period:    period.truncUnit(),
			LimitBy:   perPage,
		})
	default:
		return LeaderboardPage{}, ErrInvalidTimePeriod
	}
	if err != nil {
		return LeaderboardPage{}, err
	}

	if page < 1 || page > totalPages {
		page = 1
	}
	offset := (page - 1) * perPage

	entries := make([]LeaderboardEntry, 0, perPage)

	switch period {
	case TimePeriodAllTime:
		rows, err := l.db.queries.GetAllTimeActivityLeaderboard(ctx, l.db.dbtx, gen.GetAllTimeActivityLeaderboardParams{
			GuildID:      guildID,
			ActivityType: string(activityType),
			LimitBy:      perPage,
			OffsetBy:     offset,
		})
		if err != nil {
			return LeaderboardPage{}, err
		}

		for _, row := range rows {
			entries = append(entries, LeaderboardEntry{Rank: row.Rank, MemberID: row.MemberID, Points: row.Points})
		}
	default:
		rows, err := l.db.queries.GetActivityLeaderboard(ctx, l.db.dbtx, gen.GetActivityLeaderboardParams{
			GuildID:   guildID,
			GrantType: string(activityType),
			Period:    period.truncUnit(),
			LimitBy:   perPage,
			OffsetBy:  offset,
		})
		if err != nil {
			return LeaderboardPage{}, err
		}

		for _, row := range rows {
			entries = append(entries, LeaderboardEntry{Rank: row.Rank, MemberID: row.MemberID, Points: row.EarnedPoints})
		}
	}

	return LeaderboardPage{
		Page:       page,
		TotalPages: totalPages,
		Entries:    entries,
	}, nil
}

// GetMemberRankings returns the member's rank on the current daily, weekly, monthly and yearly leaderboards.
// A rank is 0 when the member has no points on that leaderboard.
func (l *leaderboards) GetMemberRankings(ctx context.Context, guildID, memberID snowflake.ID, activityType ActivityType) (gen.GetActivityLeaderboardRankingsRow, error) {
	if !activityType.Valid() {
		return gen.GetActivityLeaderboardRankingsRow{}, ErrInvalidActivityType
	}

	return l.db.queries.GetActivityLeaderboardRankings(ctx, l.db.dbtx, gen.GetActivityLeaderboardRankingsParams{
		GuildID:   guildID,
		MemberID:  memberID,
		GrantType: string(activityType),
	})
}

// Refresh rebuilds the daily, weekly, monthly and yearly leaderboards from the activity grant log.
// Until it runs, new grants and new periods don't show up on those leaderboards.
func (l *leaderboards) Refresh(ctx context.Context) error {
	return l.db.queries.RefreshActivityLeaderboards(ctx, l.db.dbtx)
}
