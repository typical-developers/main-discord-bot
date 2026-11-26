-- +goose Up
-- Replaces the weekly/monthly leaderboard tables with a single activity grant log.
--
-- Every grant is added to the member's row for the hour it happened in (UTC), so each row
-- holds the points a member was granted during that hour. Daily, weekly, monthly and yearly
-- leaderboards are built by summing the hours that fall inside the period, which means
-- there is nothing to archive or reset anymore.

CREATE TABLE IF NOT EXISTS guild_activity_grant_log (
    guild_id SNOWFLAKE NOT NULL,
    member_id SNOWFLAKE NOT NULL,
    grant_type TEXT NOT NULL,
    -- the start of the hour the points were granted in (UTC).
    hour_start TIMESTAMPTZ NOT NULL,
    earned_points INT NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, grant_type, hour_start, member_id)
);

-- Used by the leaderboard view to only read the hours inside the current periods.
CREATE INDEX IF NOT EXISTS guild_activity_grant_log_hour_start_idx
    ON guild_activity_grant_log (hour_start);

--------------------------------------------------------------------------------
-- The current daily, weekly, monthly and yearly leaderboards, with ranks.
--
-- Periods start in UTC and weeks start on Monday. The periods are worked out when the view is
-- refreshed, so the bot refreshes it on an interval (see RefreshActivityLeaderboards). Between
-- refreshes, new grants and new periods won't show up yet.

CREATE MATERIALIZED VIEW IF NOT EXISTS guild_activity_leaderboards AS
WITH periods (period, period_start) AS (
    VALUES
        ('day', date_trunc('day', now(), 'UTC')),
        ('week', date_trunc('week', now(), 'UTC')),
        ('month', date_trunc('month', now(), 'UTC')),
        ('year', date_trunc('year', now(), 'UTC'))
)
SELECT
    periods.period::TEXT AS period,
    log.guild_id,
    log.grant_type,
    log.member_id,
    SUM(log.earned_points)::INT AS earned_points,
    MAX(log.hour_start) AS last_grant,
    ROW_NUMBER() OVER (
        PARTITION BY periods.period, log.guild_id, log.grant_type
        ORDER BY
            SUM(log.earned_points) DESC,
            MAX(log.hour_start) DESC,
            log.member_id
    )::INT AS rank
FROM guild_activity_grant_log AS log
JOIN periods ON log.hour_start >= periods.period_start
GROUP BY periods.period, log.guild_id, log.grant_type, log.member_id;

-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY, and used for member rank lookups.
CREATE UNIQUE INDEX IF NOT EXISTS guild_activity_leaderboards_member_idx
    ON guild_activity_leaderboards (guild_id, grant_type, member_id, period);

CREATE INDEX IF NOT EXISTS guild_activity_leaderboards_rank_idx
    ON guild_activity_leaderboards (guild_id, grant_type, period, rank);

-- The old weekly/monthly tables are no longer written to and can be dropped in a later migration.

-- +goose Down
-- Rebuilds the current weekly and monthly leaderboards from the log, so points granted
-- after this migration aren't lost when rolling back.

DROP MATERIALIZED VIEW IF EXISTS guild_activity_leaderboards;

TRUNCATE TABLE guild_activity_tracking_weekly_current;
TRUNCATE TABLE guild_activity_tracking_monthly_current;

INSERT INTO guild_activity_tracking_weekly_current (
    grant_type, guild_id, member_id, earned_points
)
SELECT grant_type, guild_id, member_id, SUM(earned_points)
FROM guild_activity_grant_log
WHERE hour_start >= date_trunc('week', now(), 'UTC')
GROUP BY grant_type, guild_id, member_id;

INSERT INTO guild_activity_tracking_monthly_current (
    grant_type, guild_id, member_id, earned_points
)
SELECT grant_type, guild_id, member_id, SUM(earned_points)
FROM guild_activity_grant_log
WHERE hour_start >= date_trunc('month', now(), 'UTC')
GROUP BY grant_type, guild_id, member_id;

DROP TABLE IF EXISTS guild_activity_grant_log;
