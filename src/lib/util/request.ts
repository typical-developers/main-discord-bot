import { okAsync, errAsync } from 'neverthrow';
import RequestError from '#/lib/extensions/RequestError';

export async function request<ResponseData = any>({
    url, method, body, headers = {}, query = {}
}: {
    url: URL,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    body?: Record<string, any>,
    headers?: Record<string, any>,
    query?: Record<string, any>,
}) {
    if (Object.keys(query).length) {
        for (const [key, value] of Object.entries(query)) {
            if (typeof value === 'object') {
                url.searchParams.set(key, JSON.stringify(value));
                continue;
            }

            url.searchParams.set(key, value.toString());
        }
    }

    const request = new Request(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers
        },
        body: JSON.stringify(body)
    });

    try {
        const res = await fetch(request);

        if (!res.ok) {
            return errAsync(new RequestError({
                message: `Request failed with status code ${res.status}.`,
                request: request,
                response: res
            }));
        }

        return okAsync(await res.json() as ResponseData);
    } catch {
        return errAsync(new RequestError({
            message: `Request failed.`,
            request: request
        }));
    }
}