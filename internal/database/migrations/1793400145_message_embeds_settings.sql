-- +goose Up
CREATE TABLE IF NOT EXISTS guild_message_embeds_settings (
    guild_id TEXT NOT NULL REFERENCES guilds (guild_id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,

    disabled_channels TEXT[] NOT NULL DEFAULT '{}',
    ignored_channels TEXT[] NOT NULL DEFAULT '{}',
    ignored_roles TEXT[] NOT NULL DEFAULT '{}',

    PRIMARY KEY (guild_id)
);

--------------------------------------------------------------------------------

INSERT INTO guild_message_embeds_settings (guild_id, is_enabled)
SELECT
    guild_id,
    -- The default for the table is false,
    -- but for already registered guilds it should be set to true.
    TRUE
FROM guilds
ON CONFLICT (guild_id) DO NOTHING;

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION insert_guild_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO guild_voice_activity_settings (guild_id)
    VALUES (NEW.guild_id);

    INSERT INTO guild_chat_activity_settings (guild_id)
    VALUES (NEW.guild_id);

    INSERT INTO guild_message_embeds_settings (guild_id)
    VALUES (NEW.guild_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

--------------------------------------------------------------------------------

-- +goose Down
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

DROP TABLE guild_message_embeds_settings;
