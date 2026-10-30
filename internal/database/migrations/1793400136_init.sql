-- +goose Up
CREATE TABLE IF NOT EXISTS guild_active_voice_rooms (
    insert_epoch INT DEFAULT EXTRACT (EPOCH FROM now()),
    guild_id TEXT NOT NULL,
    origin_channel_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    created_by_user_id TEXT NOT NULL,
    current_owner_id TEXT NOT NULL,
    is_locked BOOLEAN DEFAULT false,
    PRIMARY KEY (guild_id, channel_id)
);

CREATE TABLE IF NOT EXISTS guild_activity_roles (
    insert_epoch INT DEFAULT EXTRACT (EPOCH FROM now()),
    guild_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    required_points INT DEFAULT 0,
    PRIMARY KEY (guild_id, role_id)
);

CREATE TABLE IF NOT EXISTS guild_activity_tracking_monthly (
    month_start INT DEFAULT EXTRACT(epoch FROM date_trunc('month', now() AT TIME ZONE 'utc')),
    guild_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    earned_points INT NOT NULL,
    PRIMARY KEY (month_start, guild_id, member_id)
);

CREATE TABLE IF NOT EXISTS guild_activity_tracking_weekly (
    week_start INT DEFAULT EXTRACT(epoch FROM date_trunc('week', now() AT TIME ZONE 'utc')),
    guild_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    earned_points INT NOT NULL,
    PRIMARY KEY (week_start, guild_id, member_id)
);

CREATE TABLE IF NOT EXISTS guild_profiles (
    insert_epoch INT DEFAULT EXTRACT (EPOCH FROM now() AT TIME ZONE 'utc'),
    guild_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    card_style INT DEFAULT 0 NOT NULL,
    activity_points INT NOT NULL,
    last_grant_epoch INT NOT NULL,
    PRIMARY KEY (guild_id, member_id)
);

CREATE TABLE IF NOT EXISTS guild_settings (
    insert_epoch INT DEFAULT EXTRACT (EPOCH FROM now()),
    guild_id TEXT NOT NULL,
    activity_tracking BOOLEAN DEFAULT false,
    activity_tracking_grant INT DEFAULT 2,
    activity_tracking_cooldown INT DEFAULT 15,
    PRIMARY KEY (guild_id)
);

CREATE TABLE IF NOT EXISTS guild_voice_rooms_settings (
    insert_epoch INT DEFAULT EXTRACT (EPOCH FROM now()),
    guild_id TEXT NOT NULL,
    voice_channel_id TEXT NOT NULL,
    user_limit INT DEFAULT 0 NOT NULL,
    can_rename BOOLEAN DEFAULT false NOT NULL,
    can_lock BOOLEAN DEFAULT false NOT NULL,
    can_adjust_limit BOOLEAN DEFAULT false NOT NULL,
    PRIMARY KEY (guild_id, voice_channel_id)
);

-- +goose Down
DROP TABLE IF EXISTS guild_active_voice_rooms;
DROP TABLE IF EXISTS guild_activity_roles;
DROP TABLE IF EXISTS guild_activity_tracking_monthly;
DROP TABLE IF EXISTS guild_activity_tracking_weekly;
DROP TABLE IF EXISTS guild_profiles;
DROP TABLE IF EXISTS guild_settings;
DROP TABLE IF EXISTS guild_voice_rooms_settings;
