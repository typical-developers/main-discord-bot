-- name: CreateVoiceRoomLobby :one
INSERT INTO guild_voice_rooms_settings (
    guild_id, voice_channel_id,
    user_limit, can_rename, can_lock, can_adjust_limit
)
SELECT
    @guild_id, @voice_channel_id,
    COALESCE(sqlc.narg('user_limit'), 0)::INT,
    COALESCE(sqlc.narg('can_rename'), FALSE)::BOOLEAN,
    COALESCE(sqlc.narg('can_lock'), FALSE)::BOOLEAN,
    COALESCE(sqlc.narg('can_adjust_limit'), FALSE)::BOOLEAN
RETURNING *;

-- name: GetVoiceRoomLobbies :many
SELECT
    guild_voice_rooms_settings.guild_id,
    guild_voice_rooms_settings.voice_channel_id,
    guild_voice_rooms_settings.user_limit,
    guild_voice_rooms_settings.can_rename,
    guild_voice_rooms_settings.can_lock,
    guild_voice_rooms_settings.can_adjust_limit,

    COALESCE(
        ARRAY_AGG(COALESCE(guild_active_voice_rooms.channel_id, '')),
        '{}'
    )::TEXT[] AS opened_rooms
FROM guild_voice_rooms_settings
LEFT JOIN guild_active_voice_rooms ON
    guild_voice_rooms_settings.guild_id = guild_active_voice_rooms.guild_id
WHERE guild_voice_rooms_settings.guild_id = @guild_id
GROUP BY
    guild_voice_rooms_settings.guild_id,
    guild_voice_rooms_settings.voice_channel_id;

-- name: GetVoiceRoomLobby :one
SELECT * FROM guild_voice_rooms_settings
WHERE
    guild_id = @guild_id
    AND voice_channel_id = @voice_channel_id;

-- name: UpdateVoiceRoomLobby :one
UPDATE guild_voice_rooms_settings
SET
    user_limit = COALESCE(sqlc.narg('user_limit'), user_limit)::INT,
    can_rename = COALESCE(sqlc.narg('can_rename'), can_rename)::BOOLEAN,
    can_lock = COALESCE(sqlc.narg('can_lock'), can_lock)::BOOLEAN,
    can_adjust_limit = COALESCE(sqlc.narg('can_adjust_limit'), can_adjust_limit)::BOOLEAN
WHERE
    guild_id = @guild_id
    AND voice_channel_id = @voice_channel_id
RETURNING *;

-- name: DeleteVoiceRoomLobby :exec
DELETE FROM guild_voice_rooms_settings
WHERE
    guild_id = @guild_id
    AND voice_channel_id = @voice_channel_id;

-- name: RegisterVoiceRoom :one
INSERT INTO guild_active_voice_rooms (
    guild_id, origin_channel_id,
    channel_id, created_by_user_id, current_owner_id
)
VALUES (
    @guild_id, @origin_channel_id,
    @channel_id, @created_by_user_id, @current_owner_id
)
RETURNING *;

-- name: GetVoiceRoom :one
SELECT * FROM guild_active_voice_rooms
WHERE
    guild_id = @guild_id
    AND channel_id = @channel_id;

-- name: GetVoiceRooms :many
SELECT * FROM guild_active_voice_rooms
WHERE
    guild_id = @guild_id
    AND origin_channel_id = @origin_channel_id;

-- name: GetVoiceRoomIds :one
SELECT
    COALESCE(
        ARRAY_AGG(COALESCE(guild_active_voice_rooms.channel_id, '')),
        '{}'
    )::TEXT[] AS opened_rooms
FROM guild_active_voice_rooms
WHERE
    guild_id = @guild_id
    AND origin_channel_id = @origin_channel_id;

-- name: UpdateVoiceRoom :one
UPDATE guild_active_voice_rooms
SET
    current_owner_id = COALESCE(sqlc.narg('current_owner_id'), current_owner_id),
    is_locked = COALESCE(sqlc.narg('is_locked'), is_locked)
WHERE
    guild_id = @guild_id
    AND channel_id = @channel_id
RETURNING *;

-- name: DeleteVoiceRoom :exec
DELETE FROM guild_active_voice_rooms
WHERE
    guild_id = @guild_id
    AND channel_id = @channel_id;
