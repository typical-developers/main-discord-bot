import { okAsync, errAsync } from 'neverthrow';
import type { APIResponse, GuildSettings } from '#/lib/types/api';
import { request } from '#/lib/util/request';

const { BOT_API_URL, BOT_ENDPOINT_API_KEY } = process.env

export async function createGuildSettings(guildId: string) {
    const res = await request<APIResponse<GuildSettings>>({
        url: new URL(`/guilds/${guildId}/settings`, BOT_API_URL),
        method: 'POST',
        headers: {
            Authorization: BOT_ENDPOINT_API_KEY
        }
    });

    if (res.isErr()) return res;

    return okAsync(res.value.data);
}

export async function getGuildSettings(guildId: string, { create }: { create?: boolean } = {}) {
    const res = await request<APIResponse<GuildSettings>>({
        url: new URL(`/guilds/${guildId}/settings`, BOT_API_URL),
        method: 'GET',
        headers: {
            Authorization: BOT_ENDPOINT_API_KEY
        }
    });

    if (res.isErr()) {
        if (!create) return res;

        return createGuildSettings(guildId);
    }

    return okAsync(res.value.data);
}
