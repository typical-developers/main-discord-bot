-- name: RegisterGuild :one
INSERT INTO guilds (guild_id)
VALUES (@guild_id)
RETURNING *;

-- name: GetGuildChatActivitySettings :one
SELECT
    is_enabled,
    grant_amount,
    grant_cooldown,
    deny_roles
FROM guild_chat_activity_settings
WHERE
    guild_chat_activity_settings.guild_id = @guild_id
LIMIT 1;

-- name: GetGuildVoiceActivitySettings :one
SELECT
    is_enabled,
    grant_amount,
    grant_cooldown,
    deny_roles
FROM guild_voice_activity_settings
WHERE
    guild_voice_activity_settings.guild_id = @guild_id
LIMIT 1;

-- name: GetGuildActivityRoles :many
SELECT
    role_id,
    required_points
FROM guild_activity_roles
WHERE
    guild_activity_roles.guild_id = @guild_id
    AND grant_type = @grant_type
ORDER BY required_points ASC;

-- name: GetGuildMessageEmbedSettings :one
SELECT
    is_enabled,
    disabled_channels,
    ignored_channels,
    ignored_roles
FROM guild_message_embeds_settings
WHERE
    guild_message_embeds_settings.guild_id = @guild_id
LIMIT 1;

-- name: SetGuildMessageEmbedSettings :execrows
UPDATE guild_message_embeds_settings SET
    is_enabled = @is_enabled,
    disabled_channels = @disabled_channels::SNOWFLAKE[],
    ignored_channels = @ignored_channels::SNOWFLAKE[],
    ignored_roles = @ignored_roles::SNOWFLAKE[]
WHERE
    guild_id = @guild_id;

-- name: UpdateGuildChatActivitySettings :execrows
UPDATE guild_chat_activity_settings SET
    is_enabled = COALESCE(sqlc.narg(is_enabled), guild_chat_activity_settings.is_enabled),
    grant_amount = COALESCE(sqlc.narg(grant_amount), guild_chat_activity_settings.grant_amount),
    grant_cooldown = COALESCE(sqlc.narg(grant_cooldown), guild_chat_activity_settings.grant_cooldown),
    deny_roles = COALESCE(sqlc.narg(deny_roles)::SNOWFLAKE[], guild_chat_activity_settings.deny_roles)
WHERE
    guild_id = @guild_id;

-- name: UpdateGuildVoiceActivitySettings :execrows
UPDATE guild_voice_activity_settings SET
    is_enabled = COALESCE(sqlc.narg(is_enabled), guild_voice_activity_settings.is_enabled),
    grant_amount = COALESCE(sqlc.narg(grant_amount), guild_voice_activity_settings.grant_amount),
    grant_cooldown = COALESCE(sqlc.narg(grant_cooldown), guild_voice_activity_settings.grant_cooldown),
    deny_roles = COALESCE(sqlc.narg(deny_roles)::SNOWFLAKE[], guild_voice_activity_settings.deny_roles)
WHERE
    guild_id = @guild_id;

-- name: InsertActivityRole :exec
INSERT INTO guild_activity_roles (guild_id, grant_type, role_id, required_points)
    VALUES (@guild_id, @grant_type, @role_id, @required_points::INT);

-- name: DeleteActivityRole :execrows
DELETE FROM guild_activity_roles
WHERE
    guild_id = @guild_id
    AND role_id = @role_id;

-- name: UpdateActivityRole :execrows
UPDATE guild_activity_roles SET
    required_points = @required_points::INT
WHERE
    guild_id = @guild_id
    AND role_id = @role_id;