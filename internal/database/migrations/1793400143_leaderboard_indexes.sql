-- +goose Up
CREATE INDEX guild_profiles_guild_member_idx
    ON guild_profiles (guild_id, member_id);

CREATE INDEX guild_profiles_chat_activity_idx
    ON guild_profiles (guild_id, chat_activity DESC, last_chat_activity_grant DESC);

CREATE INDEX guild_profiles_voice_activity_idx
    ON guild_profiles (guild_id, voice_activity DESC, last_voice_activity_grant DESC);

CREATE INDEX weekly_guild_grant_points_idx
    ON guild_activity_tracking_weekly_current (guild_id, grant_type, earned_points DESC);

CREATE INDEX monthly_guild_grant_points_idx
    ON guild_activity_tracking_monthly_current (guild_id, grant_type, earned_points DESC);

-- +goose Down
DROP INDEX IF EXISTS guild_profiles_guild_member_idx;
DROP INDEX IF EXISTS guild_profiles_chat_activity_idx;
DROP INDEX IF EXISTS guild_profiles_voice_activity_idx;
DROP INDEX IF EXISTS weekly_guild_grant_points_idx;
DROP INDEX IF EXISTS monthly_guild_grant_points_idx;
