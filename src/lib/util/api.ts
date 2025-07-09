import { container } from '@sapphire/framework';
import { okAsync, errAsync } from 'neverthrow';
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


type ActivityRole = {
    role_id: string;
    required_points: number;
};

type ActivityInfo = {
    rank: number;
    points: number;
    is_on_cooldown: boolean;
    last_grant: string;
    roles: {
        next: ActivityRole & {
            progress: number;
            remaining_points: number;
        }
        obtained: Array<ActivityRole>;
    }
};

export type VoiceRoomLobby = {
    channel_id: string;
    user_limit: number;
    can_rename: boolean;
    can_lock: boolean;
    can_adjust_limit: boolean;
};

export type VoiceRoom = {
    origin_channel_id: string;
    room_channel_id: string;
    created_by_user_id: string;
    current_owner_id: string;
    is_locked: boolean;
}

type GuildVoiceRoomLobbies = APIResponse<VoiceRoomLobby>;

type GuildVoiceRoom = APIResponse<VoiceRoom>;

type APIError = APIResponse<{ message: string }>;

type MemberProfile = APIResponse<{
    card_style: number;
    chat_activity: ActivityInfo;
}>;

type GuildSettings = APIResponse<{
    chat_activity: {
        cooldown_seconds: number;
        grant_amount: number;
        is_enabled: boolean;
        activity_roles: Array<ActivityRole>;
    };
    voice_rooms: Array<VoiceRoomLobby & {
        current_rooms: Array<VoiceRoom>;
    }>;
}>;

type GuildActivityRoles = APIResponse<Array<ActivityRole>>;

type IncrementActivityPoints = APIResponse<ActivityInfo>;

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
};

type GuildVoiceRoomLobbyOpts = {
    user_limit?: number | null;
    can_rename?: boolean | null;
    can_lock?: boolean | null;
    can_adjust_limit?: boolean | null;
};

type RegisterVoiceRoomOpts = {
    room_channel_id: string;
    created_by_user_id: string;
    current_owner_id: string;
};

type UpdateVoiceRoomOpts = {
    current_owner_id?: string;
    is_locked?: boolean;
}

async function createGuildSettings(guildId: string) {
    const data = await request<GuildSettings, APIError>({
        url: new URL(`/guild/${guildId}/settings/create`, BASE_URL),
        method: 'POST',
        headers: AUTH_HEADERS
    });

    if (data.isErr()) return data;

    await cache.jsonSet(`guild:${guildId}:settings`, data.value.data, "$", {
        ttl: 60 * 60 * 12
    });

    return okAsync(data.value.data);
}

async function getGuildSettings(guildId: string, { create }: GuildSettingsOpts = {}) {
    const cached = await cache.jsonGet<GuildSettings['data']>(`guild:${guildId}:settings`);
    if (cached.isOk()) return okAsync(cached.value);

    const settings = await request<GuildSettings, APIError>({
        url: new URL(`/guild/${guildId}/settings`, BASE_URL),
        method: 'GET',
        headers: AUTH_HEADERS
    });

    if (settings.isErr()) {
        const err = settings.error;

        if (err.response?.status === 404 && create) {
            const created = await createGuildSettings(guildId);
            return created;
        }

        return settings;
    }

    await cache.jsonSet(`guild:${guildId}:settings`, settings.value.data, "$", {
        ttl: 60 * 60 * 12
    });

    return okAsync(settings.value.data);
}

async function updateGuildActivitySettings(guildId: string, settings: ActivitySettingsOpts) {
    const data = await request<GuildSettings, APIError>({
        url: new URL(`/guild/${guildId}/settings/update/activity`, BASE_URL),
        method: 'PATCH',
        body: settings,
        headers: AUTH_HEADERS
    });

    if (data.isOk()) {
        await cache.jsonSet(`guild:${guildId}:settings`, data.value.data.chat_activity, "$.chat_activity", {
            ttl: 60 * 60 * 12
        });
    };

    return data;
}

async function insertGuildActivityRole(guildId: string, role: ActivityRoleOpts) {
    const data = await request<GuildActivityRoles, APIError>({
        url: new URL(`/guild/${guildId}/settings/update/add-activity-role`, BASE_URL),
        method: 'POST',
        body: role,
        headers: AUTH_HEADERS
    });

    if (data.isOk()) {
        await cache.jsonSet(`guild:${guildId}:settings`, data.value.data, "$.chat_activity.activity_roles");
    };

    return data;
}

async function createGuildVoiceRoomLobby(guildId: string, channelId: string, config: GuildVoiceRoomLobbyOpts) {
    const data = await request<GuildVoiceRoomLobbies, APIError>({
        url: new URL(`/guild/${guildId}/voice-room/lobby/${channelId}/create`, BASE_URL),
        method: 'POST',
        body: {
            channel_id: channelId,
            ...config
        },
        headers: AUTH_HEADERS
    });

    if (data.isOk()) {
        await cache.jsonSet(`guild:${guildId}:settings`, data.value.data, "$.voice_rooms");
    }

    return data;
}

async function updateGuildVoiceRoomLobby(guildId: string, channelId: string, config: GuildVoiceRoomLobbyOpts) {
    const data = await request<GuildVoiceRoomLobbies, APIError>({
        url: new URL(`/guild/${guildId}/voice-room/lobby/${channelId}/update`, BASE_URL),
        method: 'PATCH',
        body: {
            channel_id: channelId,
            ...config
        },
        headers: AUTH_HEADERS
    });

    if (data.isOk()) {
        if (!(await cache.jsonGet(`guild:${guildId}:settings`)).isOk()) {
            await getGuildSettings(guildId);
        } else {
            const settings = await cache.jsonGet(`guild:${guildId}:settings`);
            if (settings.isErr()) return data;

            await cache.client?.call(
                "JSON.MERGE",
                `guild:${guildId}:settings`, 
                `$.voice_rooms[?(@.channel_id=="${channelId}")]`,
                JSON.stringify(data.value.data)
            );
        }
    }

    return data;
}

async function removeGuildVoiceRoomLobby(guildId: string, channelId: string) {
    const data = await request<GuildVoiceRoomLobbies, APIError>({
        url: new URL(`/guild/${guildId}/voice-room/lobby/${channelId}/delete`, BASE_URL),
        method: 'DELETE',
        headers: AUTH_HEADERS
    });

    if (data.isOk()) {
        await cache.jsonSet(`guild:${guildId}:settings`, data.value.data, "$.voice_rooms");
    }

    return data;
}

async function registerGuildVoiceRoom(guildId: string, channelId: string, room: RegisterVoiceRoomOpts) {
    const data = await request<GuildVoiceRoom, APIError>({
        url: new URL(`/guild/${guildId}/voice-room/lobby/${channelId}/register`, BASE_URL),
        method: 'POST',
        body: {
            channel_id: channelId,
            ...room
        },
        headers: AUTH_HEADERS
    });

    if (data.isOk()) {
        if (!(await cache.jsonGet(`guild:${guildId}:settings`)).isOk()) {
            await getGuildSettings(guildId);
        } else {
            await cache.client.call(
                "JSON.ARRAPPEND",
                `guild:${guildId}:settings`,
                `$.voice_rooms[?(@.channel_id=="${channelId}")].current_rooms`,
                JSON.stringify(data.value.data)
            );
        }
    }

    return data;
}

async function updateGuildVoiceRoom(guildId: string, originId: string, channelId: string, config: UpdateVoiceRoomOpts) {
    const data = await request<GuildVoiceRoom, APIError>({
        url: new URL(`/guild/${guildId}/voice-room/room/${channelId}/update`, BASE_URL),
        method: 'PATCH',
        body: {
            channel_id: channelId,
            ...config
        },
        headers: AUTH_HEADERS
    });

    if (data.isOk()) {
        if (!(await cache.jsonGet(`guild:${guildId}:settings`)).isOk()) {
            await getGuildSettings(guildId);
        } else {
            await cache.client.call(
                "JSON.MERGE",
                `guild:${guildId}:settings`,
                `$.voice_rooms[?(@.channel_id=="${originId}")].current_rooms[?(@.room_channel_id=="${channelId}")]`,
                JSON.stringify(data.value.data)
            );
        }
    }

    return data;
}

async function deleteGuildVoiceRoom(guildId: string, originId: string, channelId: string) {
    const data = await request<{}, APIError>({
        url: new URL(`/guild/${guildId}/voice-room/room/${channelId}/unregister`, BASE_URL),
        method: 'DELETE',
        headers: AUTH_HEADERS
    });

    if (data.isOk()) {
        if (!(await cache.jsonGet(`guild:${guildId}:settings`)).isOk()) {
            await getGuildSettings(guildId);
        } else {
            await cache.client.call(
                "JSON.DEL",
                `guild:${guildId}:settings`,
                `$.voice_rooms[?(@.channel_id=="${originId}")].current_rooms[?(@.room_channel_id=="${channelId}")]`
            );
        }
    }

    return data;
}

async function getGuildLeaderboardCard(guildId: string, query: GuildLeaderbaordOpts) {
    const url = new URL(`/guild/${guildId}/activity-leaderboard/card`, BASE_URL);
    for (const [key, value] of Object.entries(query)) {
        url.searchParams.append(key, value);
    }
    
    return await container.imageProcessor.draw({
        url: url.toString(),
        headers: AUTH_HEADERS,
    });
}

async function createMemberProfile(guildId: string, userId: string) {
    const data = await request<MemberProfile, APIError>({
        url: new URL(`/guild/${guildId}/member/${userId}/profile/create`, BASE_URL),
        method: 'POST',
        headers: AUTH_HEADERS
    });

    if (data.isErr()) return data;

    await cache.jsonSet(`guild:${guildId}:member:${userId}:profile`, data.value.data, "$", {
        ttl: 60 * 60 * 12
    });

    return okAsync(data.value.data);
}

async function getMemberProfile(guildId: string, userId: string, { create ,force }: MemberProfileOpts = {}) {
    const cached = await cache.jsonGet<MemberProfile['data']>(`guild:${guildId}:member:${userId}:profile`);
    if (cached.isOk() && !force) return okAsync(cached.value);

    const profile = await request<MemberProfile, APIError>({
        url: new URL(`/guild/${guildId}/member/${userId}/profile`, BASE_URL),
        method: 'GET',
        headers: AUTH_HEADERS
    });

    if (profile.isErr()) {
        const err = profile.error;

        if (err.response?.status === 404 && create) {
            const created = await createMemberProfile(guildId, userId);
            return created;
        }

        return profile;
    }

    await cache.jsonSet(`guild:${guildId}:member:${userId}:profile`, profile.value.data, "$", {
        ttl: 60 * 60 * 12
    });

    return okAsync(profile.value.data);
}

async function incrementMemberActivityPoints(guildId: string, userId: string, query: IncrementActivityPointsOpts) {
    const data = await request<IncrementActivityPoints, APIError>({
        url: new URL(`/guild/${guildId}/member/${userId}/profile/increment-points`, BASE_URL),
        method: 'POST',
        headers: AUTH_HEADERS,
        query
    });

    if (data.isOk()) {
        if (query.activity_type === "chat") {
            await cache.jsonSet(`guild:${guildId}:member:${userId}:profile`, data.value.data, "$.chat_activity");
        }
    };

    return data;
}

async function getMemberProfileCard(guildId: string, userId: string) {
    const url = new URL(`/guild/${guildId}/member/${userId}/profile/card`, BASE_URL);
    
    return await container.imageProcessor.draw({
        url: url.toString(),
        headers: AUTH_HEADERS,
    });
}

export const API = {
    createGuildSettings,
    getGuildSettings,
    updateGuildActivitySettings,
    insertGuildActivityRole,
    createGuildVoiceRoomLobby,
    updateGuildVoiceRoomLobby,
    removeGuildVoiceRoomLobby,
    registerGuildVoiceRoom,
    updateGuildVoiceRoom,
    deleteGuildVoiceRoom,
    getGuildLeaderboardCard,
    createMemberProfile,
    getMemberProfile,
    getMemberProfileCard,
    incrementMemberActivityPoints,
};