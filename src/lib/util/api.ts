import { container } from '@sapphire/framework';
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
};

type GuildLeaderbaordOpts = {
    activity_type: string;
    display: string;
}

type IncrementActivityPointsOpts = {
    activity_type: "chat"
}

async function createGuildSettings(guildId: string) {
    return await request<GuildSettings, APIError>({
        url: new URL(`/guild/${guildId}/create-settings`, BASE_URL),
        method: 'POST',
        headers: AUTH_HEADERS
    });
}

async function getGuildSettings(guildId: string, { create }: GuildSettingsOpts = {}) {
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

    return settings;
}

async function getGuildLeaderboard(guildId: string, query: GuildLeaderbaordOpts) {
    const url = new URL(`/guild/${guildId}/activity-leaderboard/card`, BASE_URL);
    
    const img = await container.imageProcessor.draw({
        url: url.toString(),
    });

    return img;
}

async function createMemberProfile(guildId: string, userId: string) {
    return await request<MemberProfile, APIError>({
        url: new URL(`/guild/${guildId}/member/${userId}/create-profile`, BASE_URL),
        method: 'POST',
        headers: AUTH_HEADERS
    });
}

async function getMemberProfile(guildId: string, userId: string, { create }: MemberProfileOpts = {}) {
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

    return profile;
}

async function incrementMemberActivityPoints(guildId: string, userId: string, query: IncrementActivityPointsOpts) {
    return request<MemberProfile, APIError>({
        url: new URL(`/guild/${guildId}/member/${userId}/profile/increment-points`, BASE_URL),
        method: 'POST',
        headers: AUTH_HEADERS,
        query
    });
}

async function getMemberProfileCard(guildId: string, userId: string) {
    const url = new URL(`/guild/${guildId}/member/${userId}/profile/card`, BASE_URL);
    
    const img = await container.imageProcessor.draw({
        url: url.toString(),
    });

    return img;
}

export const API = {
    createGuildSettings,
    getGuildSettings,
    getGuildLeaderboard,
    createMemberProfile,
    getMemberProfile,
    getMemberProfileCard,
    incrementMemberActivityPoints
};