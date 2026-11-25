package database

import (
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
)

var (
	ErrInvalidActivityType = errors.New("invalid activity type")
	ErrInvalidTimePeriod   = errors.New("invalid time period")

	// Guild errors
	ErrGuildAlreadyRegistered   = errors.New("guild is already registered")
	ErrGuildNotFound            = errors.New("guild was not found")
	ErrActivityTrackingDisabled = errors.New("activity tracking is disabled")
	ErrActivityRoleExists       = errors.New("activity role already exists")
	ErrActivityRoleNotFound     = errors.New("activity role was not found")

	// Member errors
	ErrMemberProfileExists      = errors.New("member profile already exists")
	ErrMemberProfileNotFound    = errors.New("member profile was not found")
	ErrMemberOnGrantCooldown    = errors.New("member is on grant cooldown")
	ErrMemberProfileMigrateSelf = errors.New("cannot migrate a member profile to itself")

	// Voice room errors
	ErrVoiceRoomLobbyExists      = errors.New("voice room lobby already exists")
	ErrVoiceRoomLobbyNotFound    = errors.New("voice room lobby was not found")
	ErrVoiceRoomLobbyIsVoiceRoom = errors.New("voice room lobby is already an active voice room")
	ErrVoiceRoomExists           = errors.New("voice room already exists")
	ErrVoiceRoomNotFound         = errors.New("voice room was not found")
)

const (
	pgUniqueViolation     = "23505"
	pgForeignKeyViolation = "23503"
)

// pgErrorCode returns the PostgreSQL error code for err, or an empty string if err is not a PostgreSQL error.
func pgErrorCode(err error) string {
	if pgError, ok := errors.AsType[*pgconn.PgError](err); ok {
		return pgError.Code
	}

	return ""
}
