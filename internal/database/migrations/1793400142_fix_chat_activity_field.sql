-- +goose Up
ALTER TABLE guild_profiles
ALTER COLUMN chat_activity SET DEFAULT 0;

-- +goose Down
ALTER TABLE guild_profiles
ALTER COLUMN chat_activity DROP DEFAULT;
