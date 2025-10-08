import { okAsync, errAsync } from 'neverthrow';
import type { APIResponse, APIError, GuildSettings, GuildActivityTrackingUpdate, GuildActivityRoleCreate } from '#/lib/types/api';
import { request } from '#/lib/util/request';
import RequestError from '#/lib/extensions/RequestError';

const { BOT_API_URL, BOT_ENDPOINT_API_KEY } = process.env

export async function createGuildSettings(guildId: string) {
    const res = await request<APIResponse<GuildSettings>, APIError>({
        url: new URL(`/v1/guild/${guildId}/settings`, BOT_API_URL),
        method: 'POST',
        headers: {
            Authorization: BOT_ENDPOINT_API_KEY
        }
    });

    if (res.isErr()) return res;

    return okAsync(res.value.data);
}

export async function getGuildSettings(guildId: string, { create }: { create?: boolean } = {}) {
    const res = await request<APIResponse<GuildSettings>, APIError>({
        url: new URL(`/v1/guild/${guildId}/settings`, BOT_API_URL),
        method: 'GET',
        headers: {
            Authorization: BOT_ENDPOINT_API_KEY
        }
    });

    if (res.isErr()) {
        if (!(res.error instanceof RequestError)) {
            return res;
        }

        if (res.error.response.status === 404) {
            if (!create) return res;

            return createGuildSettings(guildId);
        }

        return res;
    }

    return okAsync(res.value.data);
}

export async function updateGuildActivitySettings(guildId: string, settings: GuildActivityTrackingUpdate) {
    const res = await request<APIResponse<GuildSettings>, APIError>({
        url: new URL(`/v1/guild/${guildId}/settings/activity`, BOT_API_URL),
        method: 'PATCH',
        headers: {
            Authorization: BOT_ENDPOINT_API_KEY
        },
        body: settings
    });

    return res;
}

export async function createAcitivtyRole(guildId: string, options: GuildActivityRoleCreate) {
    const res = await request<APIResponse<GuildSettings>, APIError>({
        url: new URL(`/v1/guild/${guildId}/settings/activity-roles`, BOT_API_URL),
        method: 'POST',
        headers: {
            Authorization: BOT_ENDPOINT_API_KEY
        },
        body: options
    });

    return res;
}