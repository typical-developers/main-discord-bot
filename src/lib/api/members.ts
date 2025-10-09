import { okAsync, errAsync } from 'neverthrow';
import RequestError from '#/lib/extensions/RequestError';

const { BOT_API_URL, BOT_ENDPOINT_API_KEY, BROWSERLESS_URL } = process.env;

export async function generateProfileCard(guildId: string, userId: string) {
    const url = new URL(`/v1/guild/${guildId}/member/${userId}/profile-card`, BOT_API_URL);
    const browserlessUrl = new URL("/screenshot", BROWSERLESS_URL);

    const data = {
        url: url.toString(),
        selector: "body",

        setExtraHTTPHeaders: {
            Authorization: BOT_ENDPOINT_API_KEY,
        },

        gotoOptions: {
            waitUntil: "networkidle0",
        },

        options: {
            type: "png",
            fullPage: false,
            omitBackground: true,
        },
    };

    try {
        const res = await fetch(browserlessUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data),
        });

        if (!res.ok) {
            return errAsync(new RequestError({
                message: `Request failed with status code ${res.status}.`,
                response: res,
                payload: {}
            }));
        }

        const responseCode = res.headers.get("X-Response-Code");
        if (responseCode) {
            const code = parseInt(responseCode);
            const responseText = res.headers.get("X-Response-Text")!;

            /**
             * We create a new response so the error knows what actually happened.
             */
            const clonedRes = res.clone();
            const modifiedRes = new Response(clonedRes.body, {
                status: code,
                statusText: responseText,
                headers: res.headers
            })

            if (code <= 199 || code >= 300) {
                return errAsync(new RequestError({
                    message: `Request failed with status code ${code}.`,
                    response: modifiedRes,
                    payload: {}
                }));
            }
        }

        const buffer = await res.arrayBuffer();
        return okAsync(Buffer.from(buffer));
    } catch (e) {
        return errAsync(e);
    }
}