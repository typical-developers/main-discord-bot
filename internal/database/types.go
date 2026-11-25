package database

import "github.com/jackc/pgx/v5/pgtype"

// ActivityType is the kind of activity points are granted for.
// It is stored as grant_type in the database.
type ActivityType string

const (
	ActivityTypeChat  ActivityType = "chat"
	ActivityTypeVoice ActivityType = "voice"
)

func (a ActivityType) Valid() bool {
	switch a {
	case ActivityTypeChat, ActivityTypeVoice:
		return true
	}

	return false
}

// TimePeriod is the time period a leaderboard covers.
type TimePeriod string

const (
	TimePeriodAllTime TimePeriod = "all_time"
	TimePeriodWeekly  TimePeriod = "weekly"
	TimePeriodMonthly TimePeriod = "monthly"
)

func (t TimePeriod) Valid() bool {
	switch t {
	case TimePeriodAllTime, TimePeriodWeekly, TimePeriodMonthly:
		return true
	}

	return false
}

func pgBool(b *bool) pgtype.Bool {
	if b == nil {
		return pgtype.Bool{}
	}

	return pgtype.Bool{Bool: *b, Valid: true}
}

func pgInt4(i *int32) pgtype.Int4 {
	if i == nil {
		return pgtype.Int4{}
	}

	return pgtype.Int4{Int32: *i, Valid: true}
}
