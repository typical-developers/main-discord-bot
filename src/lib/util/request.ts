import { okAsync, errAsync } from 'neverthrow';
import RequestError from '#/lib/extensions/RequestError';

export async function request<R = any, E = any>({ url, method, body, headers, query } :{
    url: URL,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    body?: Record<string, any>,
    headers?: Record<string, any>,
    query?: Record<string, any>
}) {
    const params = new URLSearchParams();
    if (query && Object.keys(query).length) {
        for (const [key, value] of Object.entries(query)) {
            if (typeof value === 'object') {
                params.set(key, JSON.stringify(value));
                continue;
            }

            params.set(key, value.toString());
        }
    }

    url.search = params.toString();

    try {
        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers,
            },
            body: JSON.stringify(body),
        });

        const contentType = res.headers.get('content-type');

        if (!res.ok) {
            let payload = {} as E;
            if (contentType === 'application/json') {
            payload = await res.json();
            }

            return errAsync(new RequestError<E>({
                message: "response was not ok.",
                response: res,
                payload
            }));
        };

        switch (contentType) {
            case 'application/json':
                return okAsync(await res.json() as R);
            case 'text/html':
                return okAsync(await res.text() as R);
            default:
                return okAsync(await res.text() as R);
        }
    } catch (e) {
        return errAsync(new RequestError({
            message: "request failed.",
            error: e
        }));
    }
}