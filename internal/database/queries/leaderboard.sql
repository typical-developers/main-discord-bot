-- name: GetAllTimeActivityLeaderboard :many
SELECT
    rankings.member_id,
    rankings.rank,
    rankings.points
FROM (
    SELECT
        member_id,
        ROW_NUMBER() OVER (
            ORDER BY
                CASE LOWER(@activity_type)::TEXT
                    WHEN 'chat' THEN chat_activity
                    WHEN 'voice' THEN voice_activity
                END DESC,
                CASE LOWER(@activity_type)::TEXT
                    WHEN 'chat' THEN last_chat_activity_grant
                    WHEN 'voice' THEN last_voice_activity_grant
                END DESC
        ) AS rank,
        CAST (
            CASE LOWER(@activity_type)::TEXT
                WHEN 'chat' THEN chat_activity
                WHEN 'voice' THEN voice_activity
            END AS INT
        ) AS points
    FROM guild_profiles
    WHERE
        guild_profiles.guild_id = @guild_id
) AS rankings
LIMIT @limit_by
OFFSET @offset_by;

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
