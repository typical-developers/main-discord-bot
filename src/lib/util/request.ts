import { okAsync, errAsync } from 'neverthrow';

export async function request<T = any>({ url, method, body, headers, query } :{
    url: URL | string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: Record<string, any>,
    headers?: Record<string, any>,
    query?: Record<string, any>
}) {
    const res = await fetch(url, { method });

    if (!res.ok) {
        return errAsync(new Error('Request failed.'));
    };

    const contentType = res.headers.get('content-type');

    switch (contentType) {
        case 'application/json':
            return okAsync(await res.json() as T);
        case 'text/html':
            return okAsync(await res.text());
        default:
            return errAsync(new Error('Invalid content type returned.'));
    }
}