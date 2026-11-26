package database

import (
	"context"
	"time"

	"github.com/disgoorg/snowflake/v2"
	"github.com/typical-developers/main-discord-bot/internal/database/gen"
)

// LeaderboardRefreshInterval is how often the workers refresh the daily, weekly, monthly and
// yearly leaderboards. Keep it in sync with the refresh job's cron spec (*/5 * * * *).
const LeaderboardRefreshInterval = 5 * time.Minute

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
	// TotalEntries is how many members are on the whole leaderboard.
	TotalEntries int32
	Entries      []LeaderboardEntry
	// UpdatedAt is roughly when the leaderboard's data was last updated (UTC). All time
	// leaderboards are live; the others are as of the last scheduled refresh.
	UpdatedAt time.Time
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
		totalEntries int32
		err          error
		updatedAt    = time.Now().UTC()
	)

	switch period {
	case TimePeriodAllTime:
		totalEntries, err = l.db.queries.GetAllTimeActivityLeaderboardSize(ctx, l.db.dbtx, guildID)
	case TimePeriodDaily, TimePeriodWeekly, TimePeriodMonthly, TimePeriodYearly:
		totalEntries, err = l.db.queries.GetActivityLeaderboardSize(ctx, l.db.dbtx, gen.GetActivityLeaderboardSizeParams{
			GuildID:   guildID,
			GrantType: string(activityType),
			Period:    period.truncUnit(),
		})
		updatedAt = updatedAt.Truncate(LeaderboardRefreshInterval)
	default:
		return LeaderboardPage{}, ErrInvalidTimePeriod
	}
	if err != nil {
		return LeaderboardPage{}, err
	}

	totalPages := (totalEntries + perPage - 1) / perPage

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
		Page:         page,
		TotalPages:   totalPages,
		TotalEntries: totalEntries,
		Entries:      entries,
		UpdatedAt:    updatedAt,
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
