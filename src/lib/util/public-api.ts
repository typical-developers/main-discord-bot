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
