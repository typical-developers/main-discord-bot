import { request } from "./request";

const BASE_URL = process.env.DEV_DEPLOYMENT !== 'true'
    ? 'https://public-api.typicaldevelopers.com/'
    : 'http://127.0.0.1:3000';

export async function fetchStore<T extends string>(store: T) {
    return await request<{
        reset_time?: string;
        shop_items: {
            type: string;
            name: string;
            currency: string;
            price: number;
            identifier: string;
            image: string;
        }[];
    }>({
        url: new URL(`/v1/oaklands/stores/${store}`, BASE_URL),
        method: 'GET',
    });
}

export async function topMaterialsToday(type: string = 'Cash') {
    return await request<{
        reset_time: string;
        last_update: string;
        currency_types: string[];
        leaderboard: {
            position: number;
            name: string;
            value: number
        }[];
    }>({
        url: new URL('/v1/oaklands/leaderboards/top-materials-today', BASE_URL),
        method: 'GET',
        query: {
            currencyType: type
        }
    });
}

export async function topUsersMonthly(type: string = 'Cash', limit: number = 25, cursor: string = '') {
    const params = new URLSearchParams();
    params.set('currencyType', type);
    params.set('limit', limit.toString());
    params.set('cursor', cursor);

    return await request<{
        reset_time: string;
        previous_page_cursor: string;
        next_page_cursor: string;
        leaderboard: {
            position: number;
            user_id: string;
            cash_amount: number;
        }[];
    }>({
        url: new URL('/v1/oaklands/leaderboards/top-players-monthly', BASE_URL),
        method: 'GET',
        query: {
            currencyType: type,
            limit: limit.toString(),
            cursor: cursor
        }
    });
}