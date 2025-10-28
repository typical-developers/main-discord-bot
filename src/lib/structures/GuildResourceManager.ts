import BaseResourceManager from "./BaseResourceManager";
import Guild, { type GuildSettings } from "./Guild";
import { errAsync, okAsync } from "neverthrow";
import RequestError from "#/lib/extensions/RequestError";
import type { APIResponse, APIError } from "#/lib/types/api";
import { request } from "#/lib/util/request";

const { BOT_API_URL, BOT_ENDPOINT_API_KEY } = process.env;

export default class GuildResourceManager extends BaseResourceManager<Guild> {
    private async _create(id: string) {
        const res = await request<APIResponse<GuildSettings>, APIError>({
            url: new URL(`/v1/guild/${id}/settings`, BOT_API_URL),
            method: 'POST',
            headers: {
                Authorization: BOT_ENDPOINT_API_KEY
            }
        });

        if (res.isErr()) return errAsync(res.error);

        const guild = new Guild(id, res.value.data);
        this.cache.set(id, guild);

        return okAsync(guild);
    }

    /**
     * Fetches an existing guild resource.
     */
    public async fetch(id: string, { createNew }: { createNew?: boolean } = {}) {
        if (this.cache.has(id))
            return okAsync(this.cache.get(id)!);

        const res = await request<APIResponse<GuildSettings>, APIError>({
            url: new URL(`/v1/guild/${id}/settings`, BOT_API_URL),
            method: 'GET',
            headers: {
                Authorization: BOT_ENDPOINT_API_KEY
            }
        });

        if (res.isErr()) {
            if (res.error instanceof RequestError && res.error.response.status === 404) {
                if (!createNew) return errAsync(res.error);
                return this._create(id);
            }

            return errAsync(res.error);
        };

        const guild = new Guild(id, res.value.data);
        this.cache.set(id, guild);

        return okAsync(guild);
    }
}
