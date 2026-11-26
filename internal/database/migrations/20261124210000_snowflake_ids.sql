-- +goose Up
-- Converts every Discord ID column from TEXT to the SNOWFLAKE domain.
--
-- Discord IDs are unsigned 64-bit integers, so they're stored as NUMERIC(20, 0)
-- with a range check. sqlc maps the domain to snowflake.ID (see sqlc.yaml).
--
-- If this migration fails with "invalid input syntax for type numeric", there is
-- a non-numeric ID stored somewhere. The whole migration runs in one transaction,
-- so nothing is changed when that happens.

CREATE DOMAIN SNOWFLAKE AS NUMERIC(20, 0)
CHECK (
    VALUE >= 0
    AND VALUE <= 18446744073709551615
);

--------------------------------------------------------------------------------
-- Foreign keys that reference guilds (guild_id) have to be dropped while the
-- referenced column changes type, then added back afterwards.

ALTER TABLE guild_chat_activity_settings
DROP CONSTRAINT guild_chat_activity_settings_guild_id_fkey;
ALTER TABLE guild_voice_activity_settings
DROP CONSTRAINT guild_voice_activity_settings_guild_id_fkey;
ALTER TABLE guild_message_embeds_settings
DROP CONSTRAINT guild_message_embeds_settings_guild_id_fkey;
ALTER TABLE guild_activity_roles
DROP CONSTRAINT guild_activity_roles_guild_id_fkey;

--------------------------------------------------------------------------------

ALTER TABLE guilds
ALTER COLUMN guild_id TYPE SNOWFLAKE USING guild_id::SNOWFLAKE;

ALTER TABLE guild_chat_activity_settings
ALTER COLUMN guild_id TYPE SNOWFLAKE USING guild_id::SNOWFLAKE,
ALTER COLUMN deny_roles DROP DEFAULT,
ALTER COLUMN deny_roles TYPE SNOWFLAKE[] USING deny_roles::SNOWFLAKE[],
ALTER COLUMN deny_roles SET DEFAULT '{}';

ALTER TABLE guild_voice_activity_settings
ALTER COLUMN guild_id TYPE SNOWFLAKE USING guild_id::SNOWFLAKE,
ALTER COLUMN deny_roles DROP DEFAULT,
ALTER COLUMN deny_roles TYPE SNOWFLAKE[] USING deny_roles::SNOWFLAKE[],
ALTER COLUMN deny_roles SET DEFAULT '{}';

ALTER TABLE guild_message_embeds_settings
ALTER COLUMN guild_id TYPE SNOWFLAKE USING guild_id::SNOWFLAKE,
ALTER COLUMN disabled_channels DROP DEFAULT,
ALTER COLUMN disabled_channels TYPE SNOWFLAKE[] USING disabled_channels::SNOWFLAKE[],
ALTER COLUMN disabled_channels SET DEFAULT '{}',
ALTER COLUMN ignored_channels DROP DEFAULT,
ALTER COLUMN ignored_channels TYPE SNOWFLAKE[] USING ignored_channels::SNOWFLAKE[],
ALTER COLUMN ignored_channels SET DEFAULT '{}',
ALTER COLUMN ignored_roles DROP DEFAULT,
ALTER COLUMN ignored_roles TYPE SNOWFLAKE[] USING ignored_roles::SNOWFLAKE[],
ALTER COLUMN ignored_roles SET DEFAULT '{}';

ALTER TABLE guild_activity_roles
ALTER COLUMN guild_id TYPE SNOWFLAKE USING guild_id::SNOWFLAKE,
ALTER COLUMN role_id TYPE SNOWFLAKE USING role_id::SNOWFLAKE;

ALTER TABLE guild_profiles
ALTER COLUMN guild_id TYPE SNOWFLAKE USING guild_id::SNOWFLAKE,
ALTER COLUMN member_id TYPE SNOWFLAKE USING member_id::SNOWFLAKE;

ALTER TABLE guild_activity_tracking_weekly
ALTER COLUMN guild_id TYPE SNOWFLAKE USING guild_id::SNOWFLAKE,
ALTER COLUMN member_id TYPE SNOWFLAKE USING member_id::SNOWFLAKE;

ALTER TABLE guild_activity_tracking_weekly_current
ALTER COLUMN guild_id TYPE SNOWFLAKE USING guild_id::SNOWFLAKE,
ALTER COLUMN member_id TYPE SNOWFLAKE USING member_id::SNOWFLAKE;

ALTER TABLE guild_activity_tracking_monthly
ALTER COLUMN guild_id TYPE SNOWFLAKE USING guild_id::SNOWFLAKE,
ALTER COLUMN member_id TYPE SNOWFLAKE USING member_id::SNOWFLAKE;

ALTER TABLE guild_activity_tracking_monthly_current
ALTER COLUMN guild_id TYPE SNOWFLAKE USING guild_id::SNOWFLAKE,
ALTER COLUMN member_id TYPE SNOWFLAKE USING member_id::SNOWFLAKE;

ALTER TABLE guild_voice_rooms_settings
ALTER COLUMN guild_id TYPE SNOWFLAKE USING guild_id::SNOWFLAKE,
ALTER COLUMN voice_channel_id TYPE SNOWFLAKE USING voice_channel_id::SNOWFLAKE;

ALTER TABLE guild_active_voice_rooms
ALTER COLUMN guild_id TYPE SNOWFLAKE USING guild_id::SNOWFLAKE,
ALTER COLUMN origin_channel_id TYPE SNOWFLAKE USING origin_channel_id::SNOWFLAKE,
ALTER COLUMN channel_id TYPE SNOWFLAKE USING channel_id::SNOWFLAKE,
ALTER COLUMN created_by_user_id TYPE SNOWFLAKE USING created_by_user_id::SNOWFLAKE,
ALTER COLUMN current_owner_id TYPE SNOWFLAKE USING current_owner_id::SNOWFLAKE;

--------------------------------------------------------------------------------

ALTER TABLE guild_chat_activity_settings
ADD CONSTRAINT guild_chat_activity_settings_guild_id_fkey
FOREIGN KEY (guild_id) REFERENCES guilds (guild_id) ON DELETE CASCADE;
ALTER TABLE guild_voice_activity_settings
ADD CONSTRAINT guild_voice_activity_settings_guild_id_fkey
FOREIGN KEY (guild_id) REFERENCES guilds (guild_id) ON DELETE CASCADE;
ALTER TABLE guild_message_embeds_settings
ADD CONSTRAINT guild_message_embeds_settings_guild_id_fkey
FOREIGN KEY (guild_id) REFERENCES guilds (guild_id) ON DELETE CASCADE;
ALTER TABLE guild_activity_roles
ADD CONSTRAINT guild_activity_roles_guild_id_fkey
FOREIGN KEY (guild_id) REFERENCES guilds (guild_id) ON DELETE CASCADE;

-- +goose Down
ALTER TABLE guild_chat_activity_settings
DROP CONSTRAINT guild_chat_activity_settings_guild_id_fkey;
ALTER TABLE guild_voice_activity_settings
DROP CONSTRAINT guild_voice_activity_settings_guild_id_fkey;
ALTER TABLE guild_message_embeds_settings
DROP CONSTRAINT guild_message_embeds_settings_guild_id_fkey;
ALTER TABLE guild_activity_roles
DROP CONSTRAINT guild_activity_roles_guild_id_fkey;

--------------------------------------------------------------------------------

ALTER TABLE guilds
ALTER COLUMN guild_id TYPE TEXT USING guild_id::TEXT;

ALTER TABLE guild_chat_activity_settings
ALTER COLUMN guild_id TYPE TEXT USING guild_id::TEXT,
ALTER COLUMN deny_roles DROP DEFAULT,
ALTER COLUMN deny_roles TYPE TEXT[] USING deny_roles::TEXT[],
ALTER COLUMN deny_roles SET DEFAULT '{}';

ALTER TABLE guild_voice_activity_settings
ALTER COLUMN guild_id TYPE TEXT USING guild_id::TEXT,
ALTER COLUMN deny_roles DROP DEFAULT,
ALTER COLUMN deny_roles TYPE TEXT[] USING deny_roles::TEXT[],
ALTER COLUMN deny_roles SET DEFAULT '{}';

ALTER TABLE guild_message_embeds_settings
ALTER COLUMN guild_id TYPE TEXT USING guild_id::TEXT,
ALTER COLUMN disabled_channels DROP DEFAULT,
ALTER COLUMN disabled_channels TYPE TEXT[] USING disabled_channels::TEXT[],
ALTER COLUMN disabled_channels SET DEFAULT '{}',
ALTER COLUMN ignored_channels DROP DEFAULT,
ALTER COLUMN ignored_channels TYPE TEXT[] USING ignored_channels::TEXT[],
ALTER COLUMN ignored_channels SET DEFAULT '{}',
ALTER COLUMN ignored_roles DROP DEFAULT,
ALTER COLUMN ignored_roles TYPE TEXT[] USING ignored_roles::TEXT[],
ALTER COLUMN ignored_roles SET DEFAULT '{}';

ALTER TABLE guild_activity_roles
ALTER COLUMN guild_id TYPE TEXT USING guild_id::TEXT,
ALTER COLUMN role_id TYPE TEXT USING role_id::TEXT;

ALTER TABLE guild_profiles
ALTER COLUMN guild_id TYPE TEXT USING guild_id::TEXT,
ALTER COLUMN member_id TYPE TEXT USING member_id::TEXT;

ALTER TABLE guild_activity_tracking_weekly
ALTER COLUMN guild_id TYPE TEXT USING guild_id::TEXT,
ALTER COLUMN member_id TYPE TEXT USING member_id::TEXT;

ALTER TABLE guild_activity_tracking_weekly_current
ALTER COLUMN guild_id TYPE TEXT USING guild_id::TEXT,
ALTER COLUMN member_id TYPE TEXT USING member_id::TEXT;

ALTER TABLE guild_activity_tracking_monthly
ALTER COLUMN guild_id TYPE TEXT USING guild_id::TEXT,
ALTER COLUMN member_id TYPE TEXT USING member_id::TEXT;

ALTER TABLE guild_activity_tracking_monthly_current
ALTER COLUMN guild_id TYPE TEXT USING guild_id::TEXT,
ALTER COLUMN member_id TYPE TEXT USING member_id::TEXT;

ALTER TABLE guild_voice_rooms_settings
ALTER COLUMN guild_id TYPE TEXT USING guild_id::TEXT,
ALTER COLUMN voice_channel_id TYPE TEXT USING voice_channel_id::TEXT;

ALTER TABLE guild_active_voice_rooms
ALTER COLUMN guild_id TYPE TEXT USING guild_id::TEXT,
ALTER COLUMN origin_channel_id TYPE TEXT USING origin_channel_id::TEXT,
ALTER COLUMN channel_id TYPE TEXT USING channel_id::TEXT,
ALTER COLUMN created_by_user_id TYPE TEXT USING created_by_user_id::TEXT,
ALTER COLUMN current_owner_id TYPE TEXT USING current_owner_id::TEXT;

--------------------------------------------------------------------------------

ALTER TABLE guild_chat_activity_settings
ADD CONSTRAINT guild_chat_activity_settings_guild_id_fkey
FOREIGN KEY (guild_id) REFERENCES guilds (guild_id) ON DELETE CASCADE;
ALTER TABLE guild_voice_activity_settings
ADD CONSTRAINT guild_voice_activity_settings_guild_id_fkey
FOREIGN KEY (guild_id) REFERENCES guilds (guild_id) ON DELETE CASCADE;
ALTER TABLE guild_message_embeds_settings
ADD CONSTRAINT guild_message_embeds_settings_guild_id_fkey
FOREIGN KEY (guild_id) REFERENCES guilds (guild_id) ON DELETE CASCADE;
ALTER TABLE guild_activity_roles
ADD CONSTRAINT guild_activity_roles_guild_id_fkey
FOREIGN KEY (guild_id) REFERENCES guilds (guild_id) ON DELETE CASCADE;

DROP DOMAIN IF EXISTS SNOWFLAKE;
