-- +goose Up
-- This is to make the database more relational.
-- 
-- These changes also allow there to be more specific settings
-- for each activity type, but I doubt that'll ever be necessary.

CREATE TABLE IF NOT EXISTS guilds (
    -- This is used as a general guilds registry.
    -- Settings are automatically created once a guild is registered.
    insert_epoch INT DEFAULT EXTRACT (EPOCH FROM now() AT TIME ZONE 'utc'),
    guild_id TEXT NOT NULL,

    PRIMARY KEY (guild_id)
);

CREATE TABLE IF NOT EXISTS guild_chat_activity_settings (
    guild_id TEXT NOT NULL REFERENCES guilds (guild_id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    grant_amount INT NOT NULL DEFAULT 2,
    grant_cooldown INT NOT NULL DEFAULT 15,
    deny_roles TEXT[] NOT NULL DEFAULT '{}',

    PRIMARY KEY (guild_id)
);

CREATE TABLE IF NOT EXISTS guild_voice_activity_settings (
    guild_id TEXT NOT NULL REFERENCES guilds (guild_id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    grant_amount INT NOT NULL DEFAULT 2,
    grant_cooldown INT NOT NULL DEFAULT 15,
    deny_roles TEXT[] NOT NULL DEFAULT '{}',

    PRIMARY KEY (guild_id)
);
--------------------------------------------------------------------------------

-- Migrates the tables to the new schema.
INSERT INTO guilds (insert_epoch, guild_id)
SELECT insert_epoch, guild_id
FROM guild_settings
ON CONFLICT (guild_id) DO NOTHING;

INSERT INTO guild_chat_activity_settings (guild_id, is_enabled, grant_amount, grant_cooldown, deny_roles)
SELECT guild_id, chat_activity_tracking, chat_activity_grant, chat_activity_cooldown, chat_activity_deny_roles
FROM guild_settings;

INSERT INTO guild_voice_activity_settings (guild_id, is_enabled, grant_amount, grant_cooldown, deny_roles)
SELECT guild_id, voice_activity_tracking, voice_activity_grant, voice_activity_cooldown, voice_grant_deny
FROM guild_settings;

ALTER TABLE guild_activity_roles
ADD CONSTRAINT guild_activity_roles_guild_id_fkey
FOREIGN KEY (guild_id) REFERENCES guilds (guild_id)
ON DELETE CASCADE;
--------------------------------------------------------------------------------

-- Inserts basic guild settings when a guild is registered.
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION insert_guild_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO guild_voice_activity_settings (guild_id)
    VALUES (NEW.guild_id);

    INSERT INTO guild_chat_activity_settings (guild_id)
    VALUES (NEW.guild_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

CREATE TRIGGER insert_guild_settings
AFTER INSERT ON guilds
FOR EACH ROW
EXECUTE FUNCTION insert_guild_settings();

DROP TABLE guild_settings;

-- +goose Down
-- Creates the old table.
CREATE TABLE IF NOT EXISTS guild_settings (
    insert_epoch INT DEFAULT EXTRACT (EPOCH FROM now() AT TIME ZONE 'utc'),
    guild_id TEXT NOT NULL,

    chat_activity_tracking BOOLEAN DEFAULT FALSE,
    chat_activity_grant INT DEFAULT 2,
    chat_activity_cooldown INT DEFAULT 15,
    chat_activity_deny_roles TEXT[] DEFAULT '{}',

    voice_activity_tracking BOOLEAN DEFAULT FALSE,
    voice_activity_grant INT DEFAULT 2,
    voice_activity_cooldown INT DEFAULT 15,
    voice_grant_deny TEXT[] DEFAULT '{}',

    PRIMARY KEY (guild_id)
);
--------------------------------------------------------------------------------

-- Migrates everything back to the old table.
WITH
    chat_settings AS (
        SELECT *
        FROM guild_chat_activity_settings
    ),
    voice_settings AS (
        SELECT *
        FROM guild_voice_activity_settings
    )
INSERT INTO guild_settings
    (
        insert_epoch,
        guild_id,
        chat_activity_tracking,
        chat_activity_grant,
        chat_activity_cooldown,
        chat_activity_deny_roles,
        voice_activity_tracking,
        voice_activity_grant,
        voice_activity_cooldown,
        voice_grant_deny
    )
SELECT
    guilds.insert_epoch,
    guilds.guild_id,

    chat_settings.is_enabled,
    chat_settings.grant_amount,
    chat_settings.grant_cooldown,
    chat_settings.deny_roles,

    voice_settings.is_enabled,
    voice_settings.grant_amount,
    voice_settings.grant_cooldown,
    voice_settings.deny_roles
FROM guilds
FULL OUTER JOIN chat_settings
    ON guilds.guild_id = chat_settings.guild_id
FULL OUTER JOIN voice_settings
    ON guilds.guild_id = voice_settings.guild_id;

ALTER TABLE guild_activity_roles
DROP CONSTRAINT IF EXISTS guild_activity_roles_guild_id_fkey;
--------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS insert_guild_settings ON guilds;
DROP FUNCTION IF EXISTS insert_guild_settings;
DROP TABLE guild_chat_activity_settings;
DROP TABLE guild_voice_activity_settings;
DROP TABLE guilds;
