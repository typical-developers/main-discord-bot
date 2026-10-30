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
    AND grant_type = @activity_type
GROUP BY grant_type, role_id, required_points
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

-- name: UpdateGuildMessageEmbedSettings :exec
UPDATE guild_message_embeds_settings SET
    is_enabled = COALESCE(sqlc.narg(is_enabled), guild_message_embeds_settings.is_enabled)
WHERE
    guild_id = @guild_id;

-- name: AppendGuildMessageEmbedSettingsArrays :exec
UPDATE guild_message_embeds_settings SET
    disabled_channels = CASE
        WHEN sqlc.narg(disabled_channel_id)::TEXT IS NOT NULL THEN
            ARRAY(
                SELECT DISTINCT v
                FROM UNNEST(ARRAY_APPEND(guild_message_embeds_settings.disabled_channels, sqlc.narg(disabled_channel_id))) AS v
            )
        ELSE
            guild_message_embeds_settings.disabled_channels
    END,

    ignored_channels = CASE
        WHEN sqlc.narg(ignored_channel_id)::TEXT IS NOT NULL THEN
            ARRAY(
                SELECT DISTINCT v
                FROM UNNEST(ARRAY_APPEND(guild_message_embeds_settings.ignored_channels, sqlc.narg(ignored_channel_id))) AS v
            )
        ELSE
            guild_message_embeds_settings.ignored_channels
    END,

    ignored_roles = CASE
        WHEN sqlc.narg(ignored_role_id)::TEXT IS NOT NULL THEN
            ARRAY(
                SELECT DISTINCT v
                FROM UNNEST(ARRAY_APPEND(guild_message_embeds_settings.ignored_roles, sqlc.narg(ignored_role_id))) AS v
            )
        ELSE
            guild_message_embeds_settings.ignored_roles
    END
WHERE
    guild_id = @guild_id;

-- name: RemoveGuildMessageEmbedSettingsArrays :exec
UPDATE guild_message_embeds_settings SET
    disabled_channels = CASE
        WHEN sqlc.narg(disabled_channel_id)::TEXT IS NOT NULL THEN
            ARRAY_REMOVE(guild_message_embeds_settings.disabled_channels, sqlc.narg(disabled_channel_id))
        ELSE
            guild_message_embeds_settings.disabled_channels
    END,

    ignored_channels = CASE
        WHEN sqlc.narg(ignored_channel_id)::TEXT IS NOT NULL THEN
            ARRAY_REMOVE(guild_message_embeds_settings.ignored_channels, sqlc.narg(ignored_channel_id))
        ELSE
            guild_message_embeds_settings.ignored_channels
    END,

    ignored_roles = CASE
        WHEN sqlc.narg(ignored_role_id)::TEXT IS NOT NULL THEN
            ARRAY_REMOVE(guild_message_embeds_settings.ignored_roles, sqlc.narg(ignored_role_id))
        ELSE
            guild_message_embeds_settings.ignored_roles
    END
WHERE
    guild_id = @guild_id;

-- name: UpdateGuildChatActivitySettings :exec
UPDATE guild_chat_activity_settings SET
    is_enabled = COALESCE(sqlc.narg(is_enabled), guild_chat_activity_settings.is_enabled),
    grant_amount = COALESCE(sqlc.narg(grant_amount), guild_chat_activity_settings.grant_amount),
    grant_cooldown = COALESCE(sqlc.narg(grant_cooldown), guild_chat_activity_settings.grant_cooldown)
WHERE
    guild_id = @guild_id;

-- name: UpdateGuildVoiceActivitySettings :exec
UPDATE guild_voice_activity_settings SET
    is_enabled = COALESCE(sqlc.narg(is_enabled), guild_voice_activity_settings.is_enabled),
    grant_amount = COALESCE(sqlc.narg(grant_amount), guild_voice_activity_settings.grant_amount),
    grant_cooldown = COALESCE(sqlc.narg(grant_cooldown), guild_voice_activity_settings.grant_cooldown)
WHERE
    guild_id = @guild_id;

-- name: InsertActivityRole :exec
INSERT INTO guild_activity_roles (guild_id, grant_type, role_id, required_points)
    VALUES (@guild_id, @grant_type, @role_id, @required_points::INT);

-- name: DeleteActivityRole :exec
DELETE FROM guild_activity_roles
WHERE
    guild_id = @guild_id
    AND role_id = @role_id;