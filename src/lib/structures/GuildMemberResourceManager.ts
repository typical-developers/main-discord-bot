import BaseResourceManager from "./BaseResourceManager";
import type Guild from "./Guild";
import GuildMember, { type GuildMemberProfile } from "./GuildMember";

import { errAsync, okAsync } from "neverthrow";
import RequestError from "#/lib/extensions/RequestError";
import type { APIResponse, APIError } from "#/lib/types/api";
import { request } from "#/lib/util/request";

const { BOT_API_URL, BOT_ENDPOINT_API_KEY } = process.env;

export default class GuildMemberResourceManager extends BaseResourceManager<GuildMember> {
    public readonly guild: Guild;

    constructor(guild: Guild) {
        super();
        this.guild = guild;
    }

    private async create(id: string) {
        const res = await request<APIResponse<GuildMemberProfile>, APIError>({
            url: new URL(`/v1/guild/${this.guild.id}/member/${id}`, BOT_API_URL),
            method: 'POST',
            headers: {
                Authorization: BOT_ENDPOINT_API_KEY
            }
        });

        if (res.isErr()) return errAsync(res.error);

        const member = new GuildMember(id, this.guild, res.value.data);
        this.cache.set(id, member);

        return okAsync(member);
    }

    public async fetch(id: string, { createNew }: { createNew?: boolean } = {}) {
        if (this.cache.has(id))
            return okAsync(this.cache.get(id)!);

        const res = await request<APIResponse<GuildMemberProfile>, APIError>({
            url: new URL(`/v1/guild/${this.guild.id}/member/${id}`, BOT_API_URL),
            method: 'GET',
            headers: {
                Authorization: BOT_ENDPOINT_API_KEY
            }
        });

        if (res.isErr()) {
            if (res.error instanceof RequestError && res.error.response.status === 404) {
                if (!createNew) return errAsync(res.error);
                return this.create(id);
            }

            return errAsync(res.error);
        };

        const member = new GuildMember(id, this.guild, res.value.data);
        this.cache.set(id, member);

        return okAsync(member);
    }

    public async migrateProfile(fromMemberId: string, toMemberId: string) {
        const res = await request<APIResponse<null>, APIError>({
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