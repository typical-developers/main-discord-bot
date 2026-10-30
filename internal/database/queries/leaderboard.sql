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

-- name: GetAllTimeActivityLeaderboardPages :one
SELECT
    CAST(CEIL(COUNT(*)::DECIMAL / @limit_by) AS INT) AS total_pages
FROM guild_profiles
WHERE
    guild_id = @guild_id;

-- name: GetWeeklyActivityLeaderboard :many
SELECT
    rankings.rank,
    rankings.member_id,
    rankings.earned_points
FROM (
    SELECT
        ROW_NUMBER() OVER (
            ORDER BY earned_points DESC
        ) AS rank,
        member_id,
        earned_points
    FROM guild_activity_tracking_weekly_current
    WHERE
        guild_id = @guild_id
        AND grant_type = @grant_type
) AS rankings
LIMIT 15
OFFSET @offset_by;

-- name: GetWeeklyActivityLeaderboardPages :one
SELECT
    CAST(CEIL(COUNT(*)::DECIMAL / @limit_by) AS INT) AS total_pages
FROM guild_activity_tracking_weekly_current
WHERE
    guild_id = @guild_id
    AND grant_type = @grant_type;

-- name: GetMonthlyActivityLeaderboard :many
SELECT
    rankings.rank,
    rankings.member_id,
    rankings.earned_points
FROM (
    SELECT
        ROW_NUMBER() OVER (
            ORDER BY earned_points DESC
        ) AS rank,
        member_id,
        earned_points
    FROM guild_activity_tracking_monthly_current
    WHERE
        guild_id = @guild_id
        AND grant_type = @grant_type
) AS rankings
LIMIT 15
OFFSET @offset_by;

-- name: GetMonthlyActivityLeaderboardPages :one
SELECT
    CAST(CEIL(COUNT(*)::DECIMAL / @limit_by) AS INT) AS total_pages
FROM guild_activity_tracking_monthly_current
WHERE
    guild_id = @guild_id
    AND grant_type = @grant_type;

-- name: GetActivityLeaderboardRankings :one
WITH
    weekly_leaderboard AS (
        SELECT
            member_id,
            COALESCE(ROW_NUMBER() OVER (ORDER BY earned_points DESC), 0)::INT AS rank
        FROM guild_activity_tracking_weekly_current
        WHERE
            guild_activity_tracking_weekly_current.guild_id = @guild_id
            AND guild_activity_tracking_weekly_current.grant_type = @grant_type
    ),
    monthly_leaderboard AS (
        SELECT
            member_id,
            COALESCE(ROW_NUMBER() OVER (ORDER BY earned_points DESC), 0)::INT AS rank
        FROM guild_activity_tracking_monthly_current
        WHERE
            guild_activity_tracking_monthly_current.guild_id = @guild_id
            AND guild_activity_tracking_monthly_current.grant_type = @grant_type
    )
SELECT
    m.member_id,
    weekly_leaderboard.rank AS weekly_leaderboard_rank,
    monthly_leaderboard.rank AS monthly_leaderboard_rank
FROM (SELECT @member_id::TEXT AS member_id) m
LEFT JOIN weekly_leaderboard ON weekly_leaderboard.member_id = m.member_id
LEFT JOIN monthly_leaderboard ON monthly_leaderboard.member_id = m.member_id;

-- name: IncrementWeeklyActivityLeaderboard :exec
INSERT INTO guild_activity_tracking_weekly_current (
    grant_type, guild_id, member_id, earned_points
)
VALUES (
    @grant_type, @guild_id, @member_id, @earned_points
)
ON CONFLICT (grant_type, guild_id, member_id)
DO UPDATE SET
    earned_points = guild_activity_tracking_weekly_current.earned_points + @earned_points
WHERE
    guild_activity_tracking_weekly_current.grant_type = @grant_type;

-- name: IncrementMonthlyActivityLeaderboard :exec
INSERT INTO guild_activity_tracking_monthly_current (
    grant_type, guild_id, member_id, earned_points
)
VALUES (
    @grant_type, @guild_id, @member_id, @earned_points
)
ON CONFLICT (grant_type, guild_id, member_id)
DO UPDATE SET
    earned_points = guild_activity_tracking_monthly_current.earned_points + @earned_points
WHERE
    guild_activity_tracking_monthly_current.grant_type = @grant_type;

-- name: GetWeeklyActivityLeaderboardResetDetails :one
SELECT
    (SELECT COUNT(*) FROM guild_activity_tracking_weekly_current) AS row_total,
    COALESCE(
        (SELECT week_start FROM guild_activity_tracking_weekly ORDER BY week_start DESC LIMIT 1),
        0
    )::INT AS last_reset,
    EXTRACT(epoch FROM date_trunc('week', now() AT TIME ZONE 'utc') - INTERVAL '1 week')::INT AS expected_reset;

-- name: ArchiveWeeklyActivityLeaderboard :exec
MERGE INTO guild_activity_tracking_weekly AS archive
USING (
    SELECT
        EXTRACT (EPOCH FROM date_trunc('week', now() AT TIME ZONE 'utc') - INTERVAL '1 week')::INT AS week_start,
        *
    FROM guild_activity_tracking_weekly_current
) AS current_leaderboard
ON
    archive.week_start = current_leaderboard.week_start
    AND archive.guild_id = current_leaderboard.guild_id
    AND archive.member_id = current_leaderboard.member_id
    AND archive.grant_type = current_leaderboard.grant_type
WHEN MATCHED THEN
    UPDATE SET
        earned_points = current_leaderboard.earned_points
WHEN NOT MATCHED THEN
    INSERT (
        week_start, guild_id, member_id, grant_type, earned_points
    )
    VALUES (
        current_leaderboard.week_start,
        current_leaderboard.guild_id,
        current_leaderboard.member_id,
        current_leaderboard.grant_type,
        current_leaderboard.earned_points
    );

-- name: FlushOudatedWeeklyActivityLeaderboard :exec
TRUNCATE TABLE guild_activity_tracking_weekly_current;

-- name: GetMonthlyActivityLeaderboardResetDetails :one
SELECT
    (SELECT COUNT(*) FROM guild_activity_tracking_monthly_current) AS row_total,
    COALESCE(
        (SELECT month_start FROM guild_activity_tracking_monthly ORDER BY month_start DESC LIMIT 1),
        0
    )::INT AS last_reset,
    EXTRACT(epoch FROM date_trunc('month', now() AT TIME ZONE 'utc') - INTERVAL '1 month')::INT AS expected_reset;

-- name: ArchiveMonthlyActivityLeaderboard :exec
MERGE INTO guild_activity_tracking_monthly AS archive
USING (
    SELECT
        EXTRACT (EPOCH FROM date_trunc('month', now() AT TIME ZONE 'utc') - INTERVAL '1 month')::INT AS month_start,
        *
    FROM guild_activity_tracking_monthly_current
) AS current_leaderboard
ON
    archive.month_start = current_leaderboard.month_start
    AND archive.guild_id = current_leaderboard.guild_id
    AND archive.member_id = current_leaderboard.member_id
    AND archive.grant_type = current_leaderboard.grant_type
WHEN MATCHED THEN
    UPDATE SET
        earned_points = current_leaderboard.earned_points
WHEN NOT MATCHED THEN
    INSERT (
        month_start, guild_id, member_id, grant_type, earned_points
    )
    VALUES (
        current_leaderboard.month_start,
        current_leaderboard.guild_id,
        current_leaderboard.member_id,
        current_leaderboard.grant_type,
        current_leaderboard.earned_points
    );

-- name: FlushOudatedMonthlyActivityLeaderboard :exec
TRUNCATE TABLE guild_activity_tracking_monthly_current;