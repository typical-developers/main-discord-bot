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

// LeaderboardResetResult describes what happened when resetting a weekly or monthly leaderboard.
type LeaderboardResetResult struct {
	// Whether the current leaderboard was archived and cleared.
	Reset bool

	RowTotal      int64
	LastReset     int32
	ExpectedReset int32
}

// GetPage returns a page of a guild's activity leaderboard. Pages start at 1.
// Requesting a page that doesn't exist returns the first page.
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
	case TimePeriodWeekly:
		totalPages, err = l.db.queries.GetWeeklyActivityLeaderboardPages(ctx, l.db.dbtx, gen.GetWeeklyActivityLeaderboardPagesParams{
			GuildID:   guildID,
			GrantType: string(activityType),
			LimitBy:   perPage,
		})
	case TimePeriodMonthly:
		totalPages, err = l.db.queries.GetMonthlyActivityLeaderboardPages(ctx, l.db.dbtx, gen.GetMonthlyActivityLeaderboardPagesParams{
			GuildID:   guildID,
			GrantType: string(activityType),
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
	case TimePeriodWeekly:
		rows, err := l.db.queries.GetWeeklyActivityLeaderboard(ctx, l.db.dbtx, gen.GetWeeklyActivityLeaderboardParams{
			GuildID:   guildID,
			GrantType: string(activityType),
			LimitBy:   perPage,
			OffsetBy:  offset,
		})
		if err != nil {
			return LeaderboardPage{}, err
		}

		for _, row := range rows {
			entries = append(entries, LeaderboardEntry{Rank: row.Rank, MemberID: row.MemberID, Points: row.EarnedPoints})
		}
	case TimePeriodMonthly:
		rows, err := l.db.queries.GetMonthlyActivityLeaderboard(ctx, l.db.dbtx, gen.GetMonthlyActivityLeaderboardParams{
			GuildID:   guildID,
			GrantType: string(activityType),
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

// GetMemberRankings returns the member's rank on the current weekly and monthly leaderboards.
// A rank is not valid when the member has no points on that leaderboard.
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

// ResetWeekly archives the current weekly leaderboard and clears it, if it hasn't been reset this week.
func (l *leaderboards) ResetWeekly(ctx context.Context) (LeaderboardResetResult, error) {
	var result LeaderboardResetResult

	err := l.db.WithTx(ctx, func(ctx context.Context, txDb *Database) error {
		details, err := txDb.queries.GetWeeklyActivityLeaderboardResetDetails(ctx, txDb.dbtx)
		if err != nil {
			return err
		}

		result = LeaderboardResetResult{
			RowTotal:      details.RowTotal,
			LastReset:     details.LastReset,
			ExpectedReset: details.ExpectedReset,
		}

		if details.LastReset >= details.ExpectedReset || details.RowTotal <= 0 {
			return nil
		}

		if err := txDb.queries.ArchiveWeeklyActivityLeaderboard(ctx, txDb.dbtx); err != nil {
			return err
		}

		if err := txDb.queries.FlushOutdatedWeeklyActivityLeaderboard(ctx, txDb.dbtx); err != nil {
			return err
		}

		result.Reset = true
		return nil
	})
	if err != nil {
		return LeaderboardResetResult{}, err
	}

	return result, nil
}

// ResetMonthly archives the current monthly leaderboard and clears it, if it hasn't been reset this month.
func (l *leaderboards) ResetMonthly(ctx context.Context) (LeaderboardResetResult, error) {
	var result LeaderboardResetResult

	err := l.db.WithTx(ctx, func(ctx context.Context, txDb *Database) error {
		details, err := txDb.queries.GetMonthlyActivityLeaderboardResetDetails(ctx, txDb.dbtx)
		if err != nil {
			return err
		}

		result = LeaderboardResetResult{
			RowTotal:      details.RowTotal,
			LastReset:     details.LastReset,
			ExpectedReset: details.ExpectedReset,
		}

		if details.LastReset >= details.ExpectedReset || details.RowTotal <= 0 {
			return nil
		}

		if err := txDb.queries.ArchiveMonthlyActivityLeaderboard(ctx, txDb.dbtx); err != nil {
			return err
		}

		if err := txDb.queries.FlushOutdatedMonthlyActivityLeaderboard(ctx, txDb.dbtx); err != nil {
			return err
		}

		result.Reset = true
		return nil
	})
	if err != nil {
		return LeaderboardResetResult{}, err
	}

	return result, nil
}
