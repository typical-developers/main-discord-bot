-- name: CreateMemberProfile :one
INSERT INTO guild_profiles (guild_id, member_id)
    VALUES (@guild_id, @member_id)
RETURNING *;

-- name: GetMemberProfile :one
WITH profiles AS (
    SELECT
        member_id,
        card_style,

        -- chat activity info
        ROW_NUMBER() OVER (ORDER BY chat_activity DESC, last_chat_activity_grant DESC) AS chat_activity_rank,
        chat_activity,
        last_chat_activity_grant,

        -- voice activity info
        ROW_NUMBER() OVER (ORDER BY voice_activity DESC, last_voice_activity_grant DESC) AS voice_activity_rank,
        voice_activity,
        last_voice_activity_grant
    FROM guild_profiles
    WHERE
        guild_profiles.guild_id = @guild_id
)
SELECT *
FROM profiles
WHERE
    member_id = @member_id;

-- name: IncrementMemberChatActivity :one
-- Grants chat activity points only if the member is off cooldown.
-- Returns no rows when the profile does not exist or the member is on cooldown.
UPDATE guild_profiles
SET
    chat_activity = chat_activity + @points::INT,
    last_chat_activity_grant = EXTRACT(EPOCH FROM now())::INT
WHERE
    guild_id = @guild_id
    AND member_id = @member_id
    AND last_chat_activity_grant + @cooldown_seconds::INT <= EXTRACT(EPOCH FROM now())
RETURNING *;

-- name: IncrementMemberVoiceActivity :one
-- Grants voice activity points only if the member is off cooldown.
-- Returns no rows when the profile does not exist or the member is on cooldown.
UPDATE guild_profiles
SET
    voice_activity = voice_activity + @points::INT,
    last_voice_activity_grant = EXTRACT(EPOCH FROM now())::INT
WHERE
    guild_id = @guild_id
    AND member_id = @member_id
    AND last_voice_activity_grant + @cooldown_seconds::INT <= EXTRACT(EPOCH FROM now())
RETURNING *;

-- name: GetMemberActivityRoleInfo :one
WITH
    activity_roles AS (
        SELECT
            role_id,
            required_points
        FROM guild_activity_roles
        WHERE
            guild_activity_roles.guild_id = @guild_id
            AND guild_activity_roles.grant_type = @grant_type
    ),
    all_role_ids AS (
        SELECT COALESCE(ARRAY_AGG(role_id), '{}')::SNOWFLAKE[] AS role_ids
        FROM activity_roles
        WHERE required_points <= CAST(@points AS INT)
    ),
    current_role_info AS (
        SELECT
            role_id,
            required_points
        FROM activity_roles
        WHERE activity_roles.required_points <= CAST(@points AS INT)
        ORDER BY required_points DESC
        LIMIT 1
    ),
    next_role_info AS (
        SELECT
            role_id,
            required_points
        FROM activity_roles
        WHERE activity_roles.required_points > CAST(@points AS INT)
        ORDER BY required_points ASC
        LIMIT 1
    )
SELECT
    all_role_ids.role_ids AS current_roles_ids,

    current_role_info.role_id AS current_role_id,
    current_role_info.required_points AS current_role_required_points,

    next_role_info.role_id AS next_role_id,
    next_role_info.required_points AS next_role_required_points
FROM all_role_ids
LEFT JOIN current_role_info ON TRUE
LEFT JOIN next_role_info ON TRUE;

-- name: MemberProfileExists :one
SELECT EXISTS (
    SELECT 1
    FROM guild_profiles
    WHERE
        guild_id = @guild_id
        AND member_id = @member_id
);

-- name: GetMemberProfileForUpdate :one
-- Locks the member's profile until the transaction ends, so no points can be granted to it
-- while it's being migrated.
SELECT *
FROM guild_profiles
WHERE
    guild_id = @guild_id
    AND member_id = @member_id
FOR UPDATE;

-- name: MigrateMemberProfile :one
-- Adds the old profile's points to the new member's profile, creating it if it doesn't exist.
-- The card style is taken from the old profile, and the latest of the two grant times is kept
-- so the migration can't reset either member's cooldown.
INSERT INTO guild_profiles (
    guild_id, member_id,
    card_style, chat_activity, last_chat_activity_grant,
    voice_activity, last_voice_activity_grant
)
VALUES (
    @guild_id, @to_member_id, @card_style,
    @chat_activity, @last_chat_activity_grant,
    @voice_activity, @last_voice_activity_grant
)
ON CONFLICT (guild_id, member_id)
DO UPDATE SET
    card_style = EXCLUDED.card_style,
    chat_activity = guild_profiles.chat_activity + EXCLUDED.chat_activity,
    last_chat_activity_grant = GREATEST(guild_profiles.last_chat_activity_grant, EXCLUDED.last_chat_activity_grant),
    voice_activity = guild_profiles.voice_activity + EXCLUDED.voice_activity,
    last_voice_activity_grant = GREATEST(guild_profiles.last_voice_activity_grant, EXCLUDED.last_voice_activity_grant)
RETURNING *;

-- name: ResetMemberProfile :exec
UPDATE guild_profiles
SET
    card_style = DEFAULT,
    chat_activity = DEFAULT,
    last_chat_activity_grant = DEFAULT,
    voice_activity = DEFAULT,
    last_voice_activity_grant = DEFAULT
WHERE
    guild_id = @guild_id
    AND member_id = @member_id;
