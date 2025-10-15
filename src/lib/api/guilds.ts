import { okAsync, errAsync } from 'neverthrow';
import type { APIResponse, APIError, GuildSettings, GuildActivityTrackingUpdate, GuildActivityRoleCreate, GuildActivityLeaderboardQuery, VoiceRoomSettings } from '#/lib/types/api';
import { request } from '#/lib/util/request';
import RequestError from '#/lib/extensions/RequestError';

const { BOT_API_URL, BOT_ENDPOINT_API_KEY, BROWSERLESS_URL } = process.env;

export async function createGuildSettings(guildId: string) {
    const res = await request<APIResponse<GuildSettings>, APIError>({
        url: new URL(`/v1/guild/${guildId}/settings`, BOT_API_URL),
        method: 'POST',
        headers: {
            Authorization: BOT_ENDPOINT_API_KEY
        }
    });

    return res
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

    return res
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

export async function generateGuildActivityLeaderboardCard(guildId: string, query: GuildActivityLeaderboardQuery) {
    const url = new URL(`/v1/guild/${guildId}/activity-leaderboard-card`, BOT_API_URL);
    const params = new URLSearchParams(query);
    url.search = params.toString();

    const browserlessUrl = new URL("/screenshot", BROWSERLESS_URL);

    const data = {
        url: url.toString(),
        selector: "body",

        setExtraHTTPHeaders: {
            Authorization: BOT_ENDPOINT_API_KEY,
        },

        gotoOptions: {
            waitUntil: "networkidle0",
        },

        options: {
            type: "png",
            fullPage: false,
            omitBackground: true,
        },
    };

    try {
        const res = await fetch(browserlessUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data),
        });

        if (!res.ok) {
            return errAsync(new RequestError({
                message: `Request failed with status code ${res.status}.`,
                response: res,
                payload: {}
            }));
        }

        const responseCode = res.headers.get("X-Response-Code");
        if (responseCode) {
            const code = parseInt(responseCode);
            const responseText = res.headers.get("X-Response-Text")!;

            /**
             * We create a new response so the error knows what actually happened.
             */
            const clonedRes = res.clone();
            const modifiedRes = new Response(clonedRes.body, {
                status: code,
                statusText: responseText,
                headers: res.headers
            })

            if (code <= 199 || code >= 300) {
                return errAsync(new RequestError({
                    message: `Request failed with status code ${code}.`,
                    response: modifiedRes,
                    payload: {}
                }));
            }
        }

        const buffer = await res.arrayBuffer();
        return okAsync(Buffer.from(buffer));
    } catch (e) {
        return errAsync(e);
    }
}

export async function createVoiceRoomLobby(guildId: string, originChannelId: string, options: Partial<VoiceRoomSettings>) {
    const res = await request<APIResponse<{}>, APIError>({
        url: new URL(`/v1/guild/${guildId}/voice-room-lobby/${originChannelId}`, BOT_API_URL),
        method: 'POST',
        headers: {
            Authorization: BOT_ENDPOINT_API_KEY
        },
        body: options
    });

    return res;
}

export async function updateVoiceRoomLobby(guildId: string, originChannelId: string, options: Partial<VoiceRoomSettings>) {
    const res = await request<APIResponse<{}>, APIError>({
        url: new URL(`/v1/guild/${guildId}/voice-room-lobby/${originChannelId}`, BOT_API_URL),
        method: 'PATCH',
        headers: {
            Authorization: BOT_ENDPOINT_API_KEY
        },
        body: options
    });

    return res;
}

export async function deleteVoiceRoomLobby(guildId: string, originChannelId: string) {
    const res = await request<APIResponse<{}>, APIError>({
        url: new URL(`/v1/guild/${guildId}/voice-room-lobby/${originChannelId}`, BOT_API_URL),
        method: 'DELETE',
        headers: {
            Authorization: BOT_ENDPOINT_API_KEY
        }
    });

    return res;
}