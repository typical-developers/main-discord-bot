import { okAsync, errAsync } from 'neverthrow';
import RequestError from '#/lib/extensions/RequestError';

export async function request<ResponseData = any, ErrorData = any>({
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

    try {
        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            body: JSON.stringify(body)
        });

        const contentType = res.headers.get('content-type');

        if (!res.ok) {
            let payload = {} as ErrorData;

            if (contentType === 'application/json') {
                payload = await res.json() as ErrorData;
            }

            return errAsync(new RequestError<ErrorData>({
                message: `Request failed with status code ${res.status}.`,
                response: res,
                payload
            }));
        }

        return okAsync(await res.json() as ResponseData);
    } catch (e) {
        return errAsync(e);
    }
}