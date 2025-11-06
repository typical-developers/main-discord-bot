import BaseResourceManager from "./BaseResourceManager";
import type Guild from "./Guild";
import VoiceRoom, { type GuildActiveVoiceRoom, type GuildActiveVoiceRoomRegisterOptions } from './VoiceRoom';

import { okAsync, errAsync } from 'neverthrow';
import type { APIResponse, APIError } from '#/lib/types/api';
import { request } from '#/lib/util/request';
import APIRequestError from "#/lib/extensions/APIRequestError";

const { BOT_API_URL, BOT_ENDPOINT_API_KEY } = process.env;

export default class ActiveVoiceRoomResourceMananger extends BaseResourceManager<VoiceRoom> {
    public readonly guild: Guild;

    constructor(guild: Guild) {
        super();
        this.guild = guild;
    }

    public async register(originChannelId: string, options: GuildActiveVoiceRoomRegisterOptions) {
        const res = await request<APIResponse<GuildActiveVoiceRoom>>({
            url: new URL(`/v1/guild/${this.guild.id}/voice-room-lobby/${originChannelId}/register`, BOT_API_URL),
            method: 'POST',
            headers: {
                Authorization: BOT_ENDPOINT_API_KEY
            },
            body: options
        });

        if (res.isErr()) {
            if (res.error.hasResponse() && res.error.hasJSON()) {
                const err = await res.error.json<APIError>();
                return errAsync(new APIRequestError(res.error, {
                    code: err.code,
                    message: err.message
                }));
            }

            return errAsync(res.error);
        }

        const room = new VoiceRoom(options.channel_id, this.guild, res.value.data);
        this.cache.set(options.channel_id, room);

        return okAsync(room);
    }

    public async get(channelId: string) {
        if (this.cache.has(channelId))
            return okAsync(this.cache.get(channelId)!);

        const res = await request<APIResponse<GuildActiveVoiceRoom>>({
            url: new URL(`/v1/guild/${this.guild.id}/voice-room/${channelId}`, BOT_API_URL),
            method: 'GET',
            headers: {
                Authorization: BOT_ENDPOINT_API_KEY
            }
        });

        if (res.isErr()) {
            if (res.error.hasResponse() && res.error.hasJSON()) {
                const err = await res.error.json<APIError>();
                return errAsync(new APIRequestError(res.error, {
                    code: err.code,
                    message: err.message
                }));
            }

            return errAsync(res.error);
        }

        const room = new VoiceRoom(channelId, this.guild, res.value.data);
        this.cache.set(channelId, room);

        return okAsync(room);
    }

    public async delete(channelId: string) {
        const res = await request<APIResponse<null>>({
            url: new URL(`/v1/guild/${this.guild.id}/voice-room/${channelId}`, BOT_API_URL),
            method: 'DELETE',
            headers: {
                Authorization: BOT_ENDPOINT_API_KEY
            }
        });

        if (res.isErr()) {
            if (res.error.hasResponse() && res.error.hasJSON()) {
                const err = await res.error.json<APIError>();
                return errAsync(new APIRequestError(res.error, {
                    code: err.code,
                    message: err.message
                }));
            }

            return errAsync(res.error);
        }

        this.cache.delete(channelId);
        return okAsync(true);
    }

    public async update(channelId: string, options: Partial<Omit<GuildActiveVoiceRoom, 'origin_channel_id' | 'creator_id' | 'settings'>>) {
        const res = await request<APIResponse<GuildActiveVoiceRoom>>({
            url: new URL(`/v1/guild/${this.guild.id}/voice-room/${channelId}`, BOT_API_URL),
            method: 'PATCH',
            headers: {
                Authorization: BOT_ENDPOINT_API_KEY
            },
            body: options
        });

        if (res.isErr()) {
            if (res.error.hasResponse() && res.error.hasJSON()) {
                const err = await res.error.json<APIError>();
                return errAsync(new APIRequestError(res.error, {
                    code: err.code,
                    message: err.message
                }));
            }

            return errAsync(res.error);
        }

        const room = new VoiceRoom(channelId, this.guild, res.value.data);
        this.cache.set(channelId, room);

        return okAsync(room);
    }
}