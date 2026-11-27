-- name: GetAllTimeActivityLeaderboard :many
-- Returns a page of the all time leaderboard. Only members with a profile in the guild are on it,
-- but their points are added up across every guild linked to it.
--
-- Guilds that aren't linked take the first branch, which reads the guild's profiles in leaderboard
-- order straight from the activity indexes. Linked guilds have to add every member's points up
-- before they can be ranked, so they take the second. Only one branch returns rows.
(
    SELECT
        guild_profiles.member_id,
        ROW_NUMBER() OVER (
            ORDER BY
                CASE LOWER(@activity_type)::TEXT
                    WHEN 'chat' THEN guild_profiles.chat_activity
                    WHEN 'voice' THEN guild_profiles.voice_activity
                END DESC,
                CASE LOWER(@activity_type)::TEXT
                    WHEN 'chat' THEN guild_profiles.last_chat_activity_grant
                    WHEN 'voice' THEN guild_profiles.last_voice_activity_grant
                END DESC
        ) AS rank,
        CAST (
            CASE LOWER(@activity_type)::TEXT
                WHEN 'chat' THEN guild_profiles.chat_activity
                WHEN 'voice' THEN guild_profiles.voice_activity
            END AS INT
        ) AS points
    FROM guild_profiles
    WHERE
        guild_profiles.guild_id = @guild_id
        AND NOT EXISTS (
            SELECT 1
            FROM guild_links AS link
            WHERE link.guild_id = @guild_id
        )
    LIMIT @limit_by
    OFFSET @offset_by
)
UNION ALL
(
    SELECT
        totals.member_id,
        ROW_NUMBER() OVER (ORDER BY totals.points DESC, totals.last_grant DESC) AS rank,
        CAST(totals.points AS INT) AS points
    FROM (
        SELECT
            own.member_id,
            SUM(
                CASE LOWER(@activity_type)::TEXT
                    WHEN 'chat' THEN linked.chat_activity
                    WHEN 'voice' THEN linked.voice_activity
                END
            ) AS points,
            MAX(
                CASE LOWER(@activity_type)::TEXT
                    WHEN 'chat' THEN linked.last_chat_activity_grant
                    WHEN 'voice' THEN linked.last_voice_activity_grant
                END
            ) AS last_grant
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
        GROUP BY own.member_id
    ) AS totals
    ORDER BY rank
    LIMIT @limit_by
    OFFSET @offset_by
)
ORDER BY rank;

-- name: GetAllTimeActivityLeaderboardSize :one
-- Returns how many members are on the all time leaderboard.
SELECT
    COUNT(*)::INT AS total_entries
FROM guild_profiles
WHERE
    guild_id = @guild_id;

-- name: GetActivityLeaderboard :many
-- Returns a page of the current leaderboard for a period: 'day', 'week', 'month' or 'year'.
SELECT
    rank::BIGINT AS rank,
    member_id,
    earned_points
FROM guild_activity_leaderboards
WHERE
    guild_id = @guild_id
    AND grant_type = @grant_type
    AND period = @period
ORDER BY rank
LIMIT @limit_by
OFFSET @offset_by;

-- name: GetActivityLeaderboardSize :one
-- Returns how many members are on the current leaderboard for a period.
SELECT
    COUNT(*)::INT AS total_entries
FROM guild_activity_leaderboards
WHERE
    guild_id = @guild_id
    AND grant_type = @grant_type
    AND period = @period;

-- name: GetActivityLeaderboardRankings :one
-- Returns the member's rank on the current daily, weekly, monthly and yearly leaderboards.
-- A rank is 0 when the member has no points in that period.
SELECT
    m.member_id,
    COALESCE(ranks.daily_leaderboard_rank, 0)::INT AS daily_leaderboard_rank,
    COALESCE(ranks.weekly_leaderboard_rank, 0)::INT AS weekly_leaderboard_rank,
    COALESCE(ranks.monthly_leaderboard_rank, 0)::INT AS monthly_leaderboard_rank,
    COALESCE(ranks.yearly_leaderboard_rank, 0)::INT AS yearly_leaderboard_rank
FROM (SELECT @member_id::SNOWFLAKE AS member_id) m
LEFT JOIN (
    SELECT
        member_id,
        MAX(rank) FILTER (WHERE period = 'day')::INT AS daily_leaderboard_rank,
        MAX(rank) FILTER (WHERE period = 'week')::INT AS weekly_leaderboard_rank,
        MAX(rank) FILTER (WHERE period = 'month')::INT AS monthly_leaderboard_rank,
        MAX(rank) FILTER (WHERE period = 'year')::INT AS yearly_leaderboard_rank
    FROM guild_activity_leaderboards
    WHERE
        guild_id = @guild_id
        AND grant_type = @grant_type
        AND member_id = @member_id
    GROUP BY member_id
) AS ranks ON ranks.member_id = m.member_id;

-- name: RefreshActivityLeaderboards :exec
-- Rebuilds the daily, weekly, monthly and yearly leaderboards from the activity grant log.
-- CONCURRENTLY lets the leaderboards be read while they're being rebuilt.
REFRESH MATERIALIZED VIEW CONCURRENTLY guild_activity_leaderboards;

-- name: LogActivityGrant :exec
-- Adds granted points to the member's activity grant log for the current hour (UTC).
INSERT INTO guild_activity_grant_log (
    guild_id, member_id, grant_type, hour_start, earned_points
)
VALUES (
    @guild_id, @member_id, @grant_type, date_trunc('hour', now(), 'UTC'), @earned_points::INT
)
ON CONFLICT (guild_id, grant_type, hour_start, member_id)
DO UPDATE SET
    earned_points = guild_activity_grant_log.earned_points + EXCLUDED.earned_points;
