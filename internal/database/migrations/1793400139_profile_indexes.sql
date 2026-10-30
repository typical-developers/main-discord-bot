-- +goose Up
-- These indexes are made to improve performance of leaderboard queries.

-- Used to get the member's ranking based on activity_points.
CREATE INDEX IF NOT EXISTS guild_profiles_rankings_index
ON guild_profiles (guild_id, activity_points DESC);

-- +goose Down
DROP INDEX IF EXISTS guild_profiles_rankings_index;
