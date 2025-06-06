import { container } from '@sapphire/framework';
import cache from '#/lib/util/cache';
import { request } from './request';

const BASE_URL = process.env.BOT_API_URL;
const AUTH = process.env.BOT_ENDPOINT_API_KEY;

const AUTH_HEADERS = {
    'X-API-KEY': AUTH
};

interface APIResponse<T> {
    /**
     * Whether or not the API request was successful.
     */
    success: boolean;
    /**
     * The data that the API returned.
     */
    data: T;
};

type APIError = APIResponse<{ message: string }>;

type GuildSettings = APIResponse<{
    chat_activity: {
        cooldown_seconds: number;
        grant_amount: number;
        is_enabled: boolean;
        activity_roles: Array<{
            role_id: string;
            required_points: number;
        }>;
    };
}>;

type MemberProfile = APIResponse<{
    card_style: number;
    chat_activity: {
        rank: number;
        points: number;
        is_on_cooldown: boolean;
        last_grant: string;
        roles: {
            next: {
                progress: number;
                remaining_points: number;
                required_points: number;
                role_id: string;
            };
            obtained: Array<{
                role_id: string;
                required_points: number;
            }>;
        }
    }
}>;

type GuildSettingsOpts = {
    /**
     * Whether or not new guild settings should be created if not found.
     */
    create?: boolean;
};

type MemberProfileOpts = {
    /**
     * Whether or not new member profile should be created if not found.
     */
    create?: boolean;
    /**
     * Prevents from fetching from the cache.
     */
    force?: boolean;
};

type GuildLeaderbaordOpts = {
    activity_type: string;
    display: string;
};

type IncrementActivityPointsOpts = {
    activity_type: "chat"
};

interface ActivitySettings {
    enabled?: boolean | null;
    cooldown?: number | null;
    grant_amount?: number | null;
};

type ActivitySettingsOpts = {
    chat_activity: ActivitySettings;
};

type ActivityRoleOpts = {
    grant_type: string;
    role_id: string;
    required_points: number;
}

async function createGuildSettings(guildId: string) {
    const data = await request<GuildSettings, APIError>({
        url: new URL(`/guild/${guildId}/settings/create`, BASE_URL),
        method: 'POST',
        headers: AUTH_HEADERS
    });

    if (data.isOk()) {
        await cache.jsonSet(`guild:${guildId}:settings`, data.value, "$", {
            ttl: 60 * 60 * 12
        });
    };

    return data;
}

async function getGuildSettings(guildId: string, { create }: GuildSettingsOpts = {}) {
    const cached = await cache.jsonGet<GuildSettings>(`guild:${guildId}:settings`);
    if (cached.isOk()) return cached;

    const settings = await request<GuildSettings, APIError>({
        url: new URL(`/guild/${guildId}/settings`, BASE_URL),
        method: 'GET',
        headers: AUTH_HEADERS
    });

    if (settings.isErr()) {
        const err = settings.error;

        if (err.response.status === 404 && create) {
            const created = await createGuildSettings(guildId);
            return created;
        }

        return settings;
    }

    await cache.jsonSet(`guild:${guildId}:settings`, settings.value, "$", {
        ttl: 60 * 60 * 12
    });

    return settings;
}

async function updateGuildActivitySettings(guildId: string, settings: ActivitySettingsOpts) {
    const data = await request<GuildSettings, APIError>({
        url: new URL(`/guild/${guildId}/settings/update/activity`, BASE_URL),
        method: 'PATCH',
        body: settings
    });

    if (data.isOk()) {
        await cache.jsonSet(`guild:${guildId}:settings`, data.value, "$", {
            ttl: 60 * 60 * 12
        });
    };

    return data;
}

async function insertGuildActivityRole(guildId: string, role: ActivityRoleOpts) {
    const data = await request<GuildSettings, APIError>({
        url: new URL(`/guild/${guildId}/settings/update/add-activity-role`, BASE_URL),
        method: 'POST',
        body: role
    });

    if (data.isOk()) {
        await cache.jsonSet(`guild:${guildId}:settings`, data.value, "$", {
            ttl: 60 * 60 * 12
        });
    };

    return data;
}

async function getGuildLeaderboardCard(guildId: string, query: GuildLeaderbaordOpts) {
    const url = new URL(`/guild/${guildId}/activity-leaderboard/card`, BASE_URL);
    for (const [key, value] of Object.entries(query)) {
        url.searchParams.append(key, value);
    }
    
    return await container.imageProcessor.draw({
        url: url.toString(),
    });
}

async function createMemberProfile(guildId: string, userId: string) {
    const data = await request<MemberProfile, APIError>({
        url: new URL(`/guild/${guildId}/member/${userId}/profile/create`, BASE_URL),
        method: 'POST',
        headers: AUTH_HEADERS
    });

    if (data.isOk()) {
        await cache.jsonSet(`guild:${guildId}:member:${userId}:profile`, data.value, "$", {
            ttl: 60 * 60 * 12
        });
    };

    return data;
}

async function getMemberProfile(guildId: string, userId: string, { create ,force }: MemberProfileOpts = {}) {
    const cached = await cache.jsonGet<MemberProfile>(`guild:${guildId}:member:${userId}:profile`);
    if (cached.isOk() && !force) return cached;

    const profile = await request<MemberProfile, APIError>({
        url: new URL(`/guild/${guildId}/member/${userId}/profile`, BASE_URL),
        method: 'GET',
        headers: AUTH_HEADERS
    });

    if (profile.isErr()) {
        const err = profile.error;

        if (err.response.status === 404 && create) {
            const created = await createMemberProfile(guildId, userId);
            return created;
        }

        return profile;
    }

    await cache.jsonSet(`guild:${guildId}:member:${userId}:profile`, profile.value, "$", {
        ttl: 60 * 60 * 12
    });

    return profile;
}

async function incrementMemberActivityPoints(guildId: string, userId: string, query: IncrementActivityPointsOpts) {
    const data = await request<MemberProfile, APIError>({
        url: new URL(`/guild/${guildId}/member/${userId}/profile/increment-points`, BASE_URL),
        method: 'POST',
        headers: AUTH_HEADERS,
        query
    });

    if (data.isOk()) {
        await cache.jsonSet(`guild:${guildId}:member:${userId}:profile`, data.value, "$", {
            ttl: 60 * 60 * 12
        });
    };

    return data;
}

async function getMemberProfileCard(guildId: string, userId: string) {
    const url = new URL(`/guild/${guildId}/member/${userId}/profile/card`, BASE_URL);
    
    return await container.imageProcessor.draw({
        url: url.toString(),
    });
}

export const API = {
    createGuildSettings,
    getGuildSettings,
    updateGuildActivitySettings,
    insertGuildActivityRole,
    getGuildLeaderboardCard,
    createMemberProfile,
    getMemberProfile,
    getMemberProfileCard,
    incrementMemberActivityPoints
};