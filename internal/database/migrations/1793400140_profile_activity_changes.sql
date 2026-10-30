-- +goose Up
-- This index doesn't seem to make much of a difference.
-- Will revisit this in the future, most likely was not understanding this completely.
DROP INDEX IF EXISTS guild_profiles_rankings_index;

-- Renames the activty_points and last_grant_epoch columns to be more specific.
ALTER TABLE guild_profiles
RENAME COLUMN activity_points TO chat_activity;
ALTER TABLE guild_profiles
RENAME COLUMN last_grant_epoch TO last_chat_activity_grant;

-- Adds new voice activity point columns & role blacklist columns.
ALTER TABLE guild_profiles
ADD COLUMN voice_activity INT DEFAULT 0 NOT NULL,
ADD COLUMN last_voice_activity_grant INT DEFAULT 0 NOT NULL,
ADD COLUMN chat_grant_deny TEXT[] DEFAULT '{}' NOT NULL,
ADD COLUMN voice_grant_deny TEXT[] DEFAULT '{}' NOT NULL;

-- +goose Down
-- First, rename the columns back so activity_points exists
ALTER TABLE guild_profiles
RENAME COLUMN chat_activity TO activity_points;

ALTER TABLE guild_profiles
RENAME COLUMN last_chat_activity_grant TO last_grant_epoch;

-- Now you can safely create the index on activity_points
CREATE INDEX IF NOT EXISTS guild_profiles_rankings_index
ON guild_profiles (guild_id, activity_points DESC);

-- Drop voice/chat grant related columns
ALTER TABLE guild_profiles
DROP COLUMN IF EXISTS voice_activity,
DROP COLUMN IF EXISTS last_voice_activity_grant,
DROP COLUMN IF EXISTS chat_grant_deny,
DROP COLUMN IF EXISTS voice_grant_deny;
