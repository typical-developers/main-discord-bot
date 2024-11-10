const BASE_URL = process.env.DEV_DEPLOYMENT !== 'true'
    ? 'https://public-api.typicaldevelopers.com/'
    : 'http://127.0.0.1:3000';

// const BASE_URL = 'https://public-api.typicaldevelopers.com/';

export function joinUrl(path: string) {
    return `${BASE_URL}${path}`;
}

async function _requestEndpoint<Result extends Object>(
    { path, params, method }:
    {
        path: string;
        params?: URLSearchParams;
        method: string;
    }
) {
    const url = new URL(path, BASE_URL);

    if (params) {
        url.search = params.toString();
    }

    const res = await fetch(url, {
        method
    });

    if (!res.ok) return null;

    const data: Result = await res.json();
    return data;
}

export async function fetchStore<T extends string>(store: T) {
    return await _requestEndpoint<{
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
        path: `/v1/oaklands/stores/${store}`,
        method: 'GET'
    });
}

export async function topMaterialsToday(type: string = 'Cash') {
    const params = new URLSearchParams()
    params.set('currencyType', type);

    return await _requestEndpoint<{
        reset_time: string;
        last_update: string;
        currency_types: string[];
        leaderboard: {
            position: number;
            name: string;
            value: number
        }[];
    }>({
        path: '/v1/oaklands/leaderboards/top-materials-today', params,
        method: 'GET'
    });
}

export async function topUsersMonthly(type: string = 'Cash', limit: number = 25, cursor: string = '') {
    const params = new URLSearchParams();
    params.set('currencyType', type);
    params.set('limit', limit.toString());
    params.set('cursor', cursor);

    return await _requestEndpoint<{
        reset_time: string;
        previous_page_cursor: string;
        next_page_cursor: string;
        leaderboard: {
            position: number;
            user_id: string;
            cash_amount: number;
        }[];
    }>({
        path: '/v1/oaklands/leaderboards/top-players-monthly', params,
        method: 'GET'
    });
}