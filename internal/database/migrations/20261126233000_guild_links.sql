-- +goose Up
-- Lets guilds be linked so their members' activity points count towards each other.
--
-- Linked guilds form a group, and a guild can only be in one group at a time. Linking a guild
-- to one that's already in a group adds it to that group, so any number of guilds can be linked.
--
-- Profiles, cooldowns, the activity grant log and the daily, weekly, monthly and yearly
-- leaderboards are still kept per guild. Only all time points are added up across the group:
-- the all time leaderboard, the points and rank on profile cards, and activity role requirements.

CREATE TABLE IF NOT EXISTS guild_link_groups (
    group_id BIGINT GENERATED ALWAYS AS IDENTITY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id)
);

CREATE TABLE IF NOT EXISTS guild_links (
    guild_id SNOWFLAKE NOT NULL REFERENCES guilds (guild_id) ON DELETE CASCADE,
    group_id BIGINT NOT NULL REFERENCES guild_link_groups (group_id) ON DELETE CASCADE,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- a guild can only be in one group.
    PRIMARY KEY (guild_id)
);

CREATE INDEX IF NOT EXISTS guild_links_group_idx
    ON guild_links (group_id);

-- Used to add up a member's points across linked guilds.
CREATE INDEX IF NOT EXISTS guild_profiles_member_guild_idx
    ON guild_profiles (member_id, guild_id);

-- +goose Down
DROP INDEX IF EXISTS guild_profiles_member_guild_idx;
DROP TABLE IF EXISTS guild_links;
DROP TABLE IF EXISTS guild_link_groups;
