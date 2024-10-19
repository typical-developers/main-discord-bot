const BASE_URL = 'https://public-api.typicaldevelopers.com/';

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

export async function classicShop() {
    return await _requestEndpoint<{
        reset_time: string;
        items: string[];
    }>({
        path: '/v1/oaklands/stores/classic-shop',
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

export async function topUsersMonthly(type: string = 'Cash') {
    const params = new URLSearchParams();
    params.set('currencyType', type);

    return await _requestEndpoint<{
        reset_time: string;
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