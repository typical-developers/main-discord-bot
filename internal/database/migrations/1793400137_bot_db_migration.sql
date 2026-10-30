-- +goose Up
-- Migrate activity roles tables to have a grant type.
ALTER TABLE guild_activity_roles
ADD COLUMN grant_type TEXT NOT NULL DEFAULT 'chat';
UPDATE guild_activity_roles
SET grant_type = 'chat';

-- Set the default to 0 to prevent a cooldown from being applied before a grant.
ALTER TABLE guild_profiles
ALTER COLUMN last_grant_epoch SET DEFAULT 0;

-- Migrate monthly and weekly activity tracking tables to have a grant type.
ALTER TABLE guild_activity_tracking_monthly
ADD COLUMN grant_type TEXT NOT NULL DEFAULT 'chat';
UPDATE guild_activity_tracking_monthly
SET grant_type = 'chat';
ALTER TABLE guild_activity_tracking_weekly
ADD COLUMN grant_type TEXT NOT NULL DEFAULT 'chat';
UPDATE guild_activity_tracking_weekly
SET grant_type = 'chat';

-- Drop old triggers and functions that are no longer used.

DROP TRIGGER IF EXISTS "monthly_tracking_leaderboard" ON guild_profiles;
DROP TRIGGER IF EXISTS "weekly_tracking_leaderboard" ON guild_profiles;

DROP FUNCTION IF EXISTS get_guild_profile;
DROP FUNCTION IF EXISTS get_guild_settings;
DROP FUNCTION IF EXISTS increment_activity_points;
DROP FUNCTION IF EXISTS update_guild_activity_roles;
DROP FUNCTION IF EXISTS update_monthly_tracking_leaderboard;
DROP FUNCTION IF EXISTS update_weekly_tracking_leaderboard;

-- Drop tables that are for Typical Developer experiences.
DROP TABLE IF EXISTS experience_ban_wave;
DROP TABLE IF EXISTS experience_infractions;
DROP TABLE IF EXISTS oaklands_daily_materials_sold;
DROP TABLE IF EXISTS oaklands_daily_materials_sold_current;
DROP TABLE IF EXISTS oaklands_join_info;
DROP TABLE IF EXISTS oaklands_monthly_player_earnings;
DROP TABLE IF EXISTS oaklands_monthly_player_earnings_current;
DROP TABLE IF EXISTS oaklands_sessions;
DROP TABLE IF EXISTS oaklands_total_sold;
DROP TABLE IF EXISTS oaklands_users_cash_earned;

-- +goose Down
ALTER TABLE guild_activity_roles
DROP COLUMN IF EXISTS grant_type;

ALTER TABLE guild_profiles
ALTER COLUMN last_grant_epoch DROP DEFAULT;

ALTER TABLE guild_activity_tracking_monthly
DROP COLUMN IF EXISTS grant_type;

ALTER TABLE guild_activity_tracking_weekly
DROP COLUMN IF EXISTS grant_type;
