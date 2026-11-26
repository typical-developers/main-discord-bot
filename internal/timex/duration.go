package timex

import (
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var (
	DurationRegex = regexp.MustCompile(`(\d+)\s*(s|sec|m|min|h|hr|hrs|d|w|wk|mo|y|yr)\b`)
)

var (
	ErrInvalidDuration = errors.New("invalid duration")
)

// ParseDurationFromString will take a string input and prase it into a usable time.Duration.
func ParseDurationFromString(input string) (*time.Duration, error) {
	input = strings.TrimSpace(strings.ToLower(input))

	units := map[string]time.Duration{
		"s": time.Second, "sec": time.Second,
		"m": time.Minute, "min": time.Minute,
		"h": time.Hour, "hr": time.Hour, "hrs": time.Hour,
		"d": 24 * time.Hour,
		"w": 7 * 24 * time.Hour, "wk": 7 * 24 * time.Hour,
		"mo": 30 * 24 * time.Hour,
		"y":  365 * 24 * time.Hour, "yr": 365 * 24 * time.Hour,
	}

	matches := DurationRegex.FindAllStringSubmatch(input, -1)
	if matches == nil {
		return nil, ErrInvalidDuration
	}

	var total time.Duration
	for _, match := range matches {
		duration := match[1]
		unit := match[2]

		amount, err := strconv.Atoi(duration)
		if err != nil {
			return nil, ErrInvalidDuration
		}

		total += time.Duration(amount) * units[unit]
	}

	return &total, nil
}

// FormatDurationFromTime will calculate the duration based on a start and end time.
func FormatDurationFromTime(start, end time.Time) string {
	duration := end.Sub(start).Truncate(time.Second)
	sign := ""
	if duration < 0 {
		sign = "-"
		duration = -duration
	}

	days := duration / (24 * time.Hour)
	duration %= 24 * time.Hour
	hours := duration / time.Hour
	duration %= time.Hour
	minutes := duration / time.Minute
	seconds := (duration % time.Minute) / time.Second

	parts := make([]string, 0, 4)
	if days > 0 {
		parts = append(parts, fmt.Sprintf("%dd", days))
	}
	if hours > 0 {
		parts = append(parts, fmt.Sprintf("%dhr", hours))
	}
	if minutes > 0 {
		parts = append(parts, fmt.Sprintf("%dmin", minutes))
	}
	if seconds > 0 || len(parts) == 0 {
		parts = append(parts, fmt.Sprintf("%dsec", seconds))
	}

	return sign + strings.Join(parts, " ")
}
