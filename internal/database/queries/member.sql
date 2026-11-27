-- name: CreateMemberProfile :one
INSERT INTO guild_profiles (guild_id, member_id)
    VALUES (@guild_id, @member_id)
RETURNING *;

-- name: GetMemberProfile :one
-- Returns the member's profile in the guild with their all time chat and voice rank.
--
-- chat_activity, voice_activity, the last grant times and the ranks are added up across every
-- guild linked to this one. Ranks are only against members with a profile in this guild, the same
-- as the all time leaderboard. guild_chat_activity and guild_voice_activity are the points earned
-- in this guild alone.
--
-- Like the all time leaderboard, guilds that aren't linked take the first branch, which ranks the
-- guild's profiles as they are, and linked guilds take the second. Only one branch returns a row.
(
    SELECT
        ranked.member_id,
        ranked.card_style,

        ranked.chat_activity_rank,
        ranked.chat_activity,
        ranked.last_chat_activity_grant,

        ranked.voice_activity_rank,
        ranked.voice_activity,
        ranked.last_voice_activity_grant,

        ranked.chat_activity AS guild_chat_activity,
        ranked.voice_activity AS guild_voice_activity
    FROM (
        SELECT
            guild_profiles.member_id,
            guild_profiles.card_style,

            -- chat activity info
            ROW_NUMBER() OVER (ORDER BY guild_profiles.chat_activity DESC, guild_profiles.last_chat_activity_grant DESC) AS chat_activity_rank,
            guild_profiles.chat_activity,
            guild_profiles.last_chat_activity_grant,

            -- voice activity info
            ROW_NUMBER() OVER (ORDER BY guild_profiles.voice_activity DESC, guild_profiles.last_voice_activity_grant DESC) AS voice_activity_rank,
            guild_profiles.voice_activity,
            guild_profiles.last_voice_activity_grant
        FROM guild_profiles
        WHERE
            guild_profiles.guild_id = @guild_id
            AND NOT EXISTS (
                SELECT 1
                FROM guild_links AS link
                WHERE link.guild_id = @guild_id
            )
    ) AS ranked
    WHERE
        ranked.member_id = @member_id::SNOWFLAKE
)
UNION ALL
(
    SELECT
        ranked.member_id,
        ranked.card_style,

        ranked.chat_activity_rank,
        ranked.chat_activity,
        ranked.last_chat_activity_grant,

        ranked.voice_activity_rank,
        ranked.voice_activity,
        ranked.last_voice_activity_grant,

        ranked.guild_chat_activity,
        ranked.guild_voice_activity
    FROM (
        SELECT
            own.member_id,
            own.card_style,

            -- chat activity info
            ROW_NUMBER() OVER (ORDER BY SUM(linked.chat_activity) DESC, MAX(linked.last_chat_activity_grant) DESC) AS chat_activity_rank,
            CAST(SUM(linked.chat_activity) AS INT) AS chat_activity,
            CAST(MAX(linked.last_chat_activity_grant) AS INT) AS last_chat_activity_grant,

            -- voice activity info
            ROW_NUMBER() OVER (ORDER BY SUM(linked.voice_activity) DESC, MAX(linked.last_voice_activity_grant) DESC) AS voice_activity_rank,
            CAST(SUM(linked.voice_activity) AS INT) AS voice_activity,
            CAST(MAX(linked.last_voice_activity_grant) AS INT) AS last_voice_activity_grant,

            own.chat_activity AS guild_chat_activity,
            own.voice_activity AS guild_voice_activity
        FROM guild_profiles AS own
        JOIN guild_links AS self ON self.guild_id = own.guild_id
        JOIN guild_links AS others ON others.group_id = self.group_id
        JOIN guild_profiles AS linked
            ON linked.guild_id = others.guild_id
            AND linked.member_id = own.member_id
        WHERE
            own.guild_id = @guild_id
            AND EXISTS (
                SELECT 1
                FROM guild_links AS link
                WHERE link.guild_id = @guild_id
            )
        GROUP BY own.guild_id, own.member_id, own.card_style, own.chat_activity, own.voice_activity
    ) AS ranked
    WHERE
        ranked.member_id = @member_id::SNOWFLAKE
);

-- name: GetMemberLinkedActivity :one
-- Returns the member's chat and voice points added up across every guild linked to this one
-- (just this guild when it isn't linked). Both are 0 when the member has no profiles.
SELECT
    CAST(COALESCE(SUM(guild_profiles.chat_activity), 0) AS INT) AS chat_activity,
    CAST(COALESCE(SUM(guild_profiles.voice_activity), 0) AS INT) AS voice_activity
FROM guild_profiles
WHERE
    guild_profiles.member_id = @member_id
    AND (
        guild_profiles.guild_id = @guild_id
        OR guild_profiles.guild_id IN (
            SELECT others.guild_id
            FROM guild_links AS self
            JOIN guild_links AS others ON others.group_id = self.group_id
            WHERE self.guild_id = @guild_id
        )
    );

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

-- name: GetMemberProfileForUpdate :batchone
-- Locks the member's profile until the transaction ends, so no points can be granted to it
-- while it's being migrated.
SELECT *
FROM guild_profiles
WHERE
    guild_id = @guild_id
    AND member_id = @member_id
FOR UPDATE;

-- name: MigrateMemberProfile :batchone
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

-- name: ResetMemberProfile :batchexec
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
