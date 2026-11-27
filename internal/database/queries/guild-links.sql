-- name: LockGuildLinks :exec
-- Serializes changes to linked guilds until the transaction ends. Links change rarely,
-- so a single lock for all of them keeps merging groups safe without locking rows.
SELECT pg_advisory_xact_lock(hashtext('guild_links'));

-- name: GetGuildLinkGroup :one
SELECT group_id
FROM guild_links
WHERE
    guild_id = @guild_id;

-- name: CreateGuildLinkGroup :one
INSERT INTO guild_link_groups DEFAULT VALUES
RETURNING group_id;

-- name: AddGuildLink :exec
INSERT INTO guild_links (guild_id, group_id)
VALUES (@guild_id, @group_id);

-- name: MergeGuildLinkGroups :exec
-- Moves every guild in one group into another.
UPDATE guild_links
SET group_id = @into_group_id
WHERE
    group_id = @from_group_id;

-- name: DeleteGuildLink :one
-- Removes a guild from its group, returning the group it was in.
DELETE FROM guild_links
WHERE
    guild_id = @guild_id
RETURNING group_id;

-- name: DeleteGuildLinkGroup :exec
-- Deletes a group, unlinking every guild still in it.
DELETE FROM guild_link_groups
WHERE
    group_id = @group_id;

-- name: CountGuildLinkGroupGuilds :one
SELECT COUNT(*)::INT AS total_guilds
FROM guild_links
WHERE
    group_id = @group_id;

-- name: GetLinkedGuilds :many
-- Returns the other guilds linked to a guild, in the order they were linked.
SELECT
    others.guild_id,
    others.linked_at
FROM guild_links AS self
JOIN guild_links AS others
    ON others.group_id = self.group_id
    AND others.guild_id <> self.guild_id
WHERE
    self.guild_id = @guild_id
ORDER BY others.linked_at, others.guild_id;
