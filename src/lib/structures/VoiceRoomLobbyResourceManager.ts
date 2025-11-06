import BaseResourceManager from "./BaseResourceManager";
import type Guild from "./Guild";
import VoiceRoomLobby, { type GuildVoiceRoomLobby, type GuildVoiceRoomLobbyOptions } from './VoiceRoomLobby';
import type { GuildActiveVoiceRoomRegisterOptions } from "./VoiceRoom";

import { okAsync, errAsync } from 'neverthrow';
import type { APIResponse, APIError } from '#/lib/types/api';
import { request } from '#/lib/util/request';
import APIRequestError from '#/lib/extensions/APIRequestError';

const { BOT_API_URL, BOT_ENDPOINT_API_KEY } = process.env;

export class VoiceRoomLobbyResourceManager extends BaseResourceManager<VoiceRoomLobby> {
    public readonly guild: Guild;

    constructor(guild: Guild) {
        super();
        
        this.guild = guild;
    }

    public async create(originChannelId: string, options: GuildVoiceRoomLobbyOptions) {
        const res = await request<APIResponse<GuildVoiceRoomLobby>>({
            url: new URL(`/v1/guild/${this.guild.id}/voice-room-lobby/${originChannelId}`, BOT_API_URL),
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

        this.cache.set(originChannelId, new VoiceRoomLobby(this.guild, res.value.data));

        return okAsync(this);
    }

    public async get(originChannelId: string) {
        if (this.cache.has(originChannelId))
            return okAsync(this.cache.get(originChannelId)!);

        const res = await request<APIResponse<GuildVoiceRoomLobby>>({
            url: new URL(`/v1/guild/${this.guild.id}/voice-room-lobby/${originChannelId}`, BOT_API_URL),
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

        const room = new VoiceRoomLobby(this.guild, res.value.data);
        this.cache.set(originChannelId, room);

        return okAsync(room);
    }

    public async update(originChannelId: string, options: GuildVoiceRoomLobbyOptions) {
        const res = await request<APIResponse<GuildVoiceRoomLobby>>({
            url: new URL(`/v1/guild/${this.guild.id}/voice-room-lobby/${originChannelId}`, BOT_API_URL),
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

        this.cache.set(originChannelId, new VoiceRoomLobby(this.guild, res.value.data));

        return okAsync(this);
    }

    public async delete(originChannelId: string) {
        const res = await request<APIResponse<GuildVoiceRoomLobby>>({
            url: new URL(`/v1/guild/${this.guild.id}/voice-room-lobby/${originChannelId}`, BOT_API_URL),
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

        this.cache.delete(originChannelId);
        return okAsync(this);
    }

    public async register(originChannelId: string, options: GuildActiveVoiceRoomRegisterOptions) {
        return this.guild.activeVoiceRooms.register(originChannelId, options);
    }
}