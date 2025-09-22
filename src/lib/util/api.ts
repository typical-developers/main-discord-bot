import { container } from '@sapphire/framework';
import { okAsync, errAsync } from 'neverthrow';
import { request } from './request';

const BASE_URL = process.env.BOT_API_URL;

const AUTH_HEADERS = {
    'X-API-KEY': process.env.BOT_ENDPOINT_API_KEY
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

function createGuildSettings(guildId: string) {
    const res = request<APIResponse<any>>({
        url: new URL(`/guilds/${guildId}/settings`, BASE_URL),
        method: 'GET',
        headers: AUTH_HEADERS
    });
}