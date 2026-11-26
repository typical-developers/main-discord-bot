package database

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
	TimePeriodDaily   TimePeriod = "daily"
	TimePeriodWeekly  TimePeriod = "weekly"
	TimePeriodMonthly TimePeriod = "monthly"
	TimePeriodYearly  TimePeriod = "yearly"
)

func (t TimePeriod) Valid() bool {
	switch t {
	case TimePeriodAllTime, TimePeriodDaily, TimePeriodWeekly, TimePeriodMonthly, TimePeriodYearly:
		return true
	}

	return false
}

// truncUnit is the Postgres date_trunc unit for the period, used to find when the current period
// started. It is empty for all time.
func (t TimePeriod) truncUnit() string {
	switch t {
	case TimePeriodDaily:
		return "day"
	case TimePeriodWeekly:
		return "week"
	case TimePeriodMonthly:
		return "month"
	case TimePeriodYearly:
		return "year"
	}

	return ""
}
