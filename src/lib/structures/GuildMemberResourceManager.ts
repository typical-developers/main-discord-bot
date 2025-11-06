import BaseResourceManager from "./BaseResourceManager";
import type Guild from "./Guild";
import GuildMember, { type GuildMemberProfile } from "./GuildMember";

import { errAsync, okAsync } from "neverthrow";
import { APIErrorCodes, type APIError, type APIResponse } from "#/lib/types/api";
import { request } from "#/lib/util/request";
import APIRequestError from '#/lib/extensions/APIRequestError';

const { BOT_API_URL, BOT_ENDPOINT_API_KEY } = process.env;

export default class GuildMemberResourceManager extends BaseResourceManager<GuildMember> {
    public readonly guild: Guild;

    constructor(guild: Guild) {
        super();
        this.guild = guild;
    }

    private async create(id: string) {
        const res = await request<APIResponse<GuildMemberProfile>>({
            url: new URL(`/v1/guild/${this.guild.id}/member/${id}`, BOT_API_URL),
            method: 'POST',
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

        const member = new GuildMember(id, this.guild, res.value.data);
        this.cache.set(id, member);

        return okAsync(member);
    }

    public async fetch(id: string, { createNew }: { createNew?: boolean } = {}) {
        if (this.cache.has(id))
            return okAsync(this.cache.get(id)!);

        const res = await request<APIResponse<GuildMemberProfile>>({
            url: new URL(`/v1/guild/${this.guild.id}/member/${id}`, BOT_API_URL),
            method: 'GET',
            headers: {
                Authorization: BOT_ENDPOINT_API_KEY
            }
        });

        if (res.isErr()) {
            if (res.error.hasResponse() && res.error.hasJSON()) {
                const err = await res.error.json<APIError>();

                if (err.code === APIErrorCodes.MemberProfileNotFound && createNew) {
                    return this.create(id);
                }

                return errAsync(new APIRequestError(res.error, {
                    code: err.code,
                    message: err.message
                }));
            }

            return errAsync(res.error);
        };

        const member = new GuildMember(id, this.guild, res.value.data);
        this.cache.set(id, member);

        return okAsync(member);
    }

    public async migrateProfile(fromMemberId: string, toMemberId: string) {
        const res = await request<APIResponse<null>>({
            url: new URL(`/v1/guild/${this.guild.id}/member/${fromMemberId}/migrate`, BOT_API_URL),
            method: 'POST',
            headers: {
                Authorization: BOT_ENDPOINT_API_KEY,
                'Content-Type': 'application/json'
            },
            body: { to_member_id: toMemberId }
        });

        if (res.isErr()) 
            return res;

        return okAsync(true);
    }
}