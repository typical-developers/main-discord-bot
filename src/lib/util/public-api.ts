const BASE_URL = 'https://public-api.typicaldevelopers.com/';

export async function classicShop() {
    const url = new URL('/v1/oaklands/stores/classic-shop', BASE_URL);
    const res = await fetch(url);
    
    if (!res.ok) {
        return null;
    }

    const data: { reset_time: string; items: string[] } = await res.json();
    return data;
}
