import type Guild from "./Guild";
import type { ActivityType, ActivityPeriod } from "./BaseActivitySettings";

import { okAsync, errAsync } from 'neverthrow';
import type { APIResponse } from '#/lib/types/api';
import { request } from '#/lib/util/request';
import RequestError from '#/lib/extensions/RequestError';

const { BOT_ENDPOINT_API_KEY, BOT_API_URL, BROWSERLESS_URL } = process.env;

export type ActivityLeaderboard = {
    current_page: number;
    total_pages: number;
    has_next_page: boolean;
    html: string;
};

export type GuildActivityLeaderboardQueryOptions = {
    page: number;
    activity_type: ActivityType;
    time_period: ActivityPeriod;
};

class BaseActivityLeaderboard {
    public readonly guild: Guild;

    constructor(guild: Guild) {
        this.guild = guild
    }

    /**
     * Gets the leaderboard page details.
     */
    public static async get(guild: Guild, { page, activity_type, time_period }: GuildActivityLeaderboardQueryOptions) {
        const url = new URL(`/v2/guild/${guild.id}/activity-leaderboard`, BOT_API_URL);
        const params = new URLSearchParams({ page: page.toString(), activity_type, time_period });
        url.search = params.toString();

        const res = await request<APIResponse<ActivityLeaderboard>>({
            url,
            method: 'GET',
            headers: {
                Authorization: BOT_ENDPOINT_API_KEY,
                Referer: BOT_API_URL
            },
            query: { page: page }
        });

        if (res.isErr())
            return errAsync(res.error);

        return okAsync(new GuildActivityLeaderboard(guild, { page, activity_type, time_period, ...res.value.data }));
    }
}

export default class GuildActivityLeaderboard extends BaseActivityLeaderboard {
    /**
     * The type of activity that the leaderboard is for.
     */
    public readonly activityType: ActivityType;
    /**
     * The time period that the leaderboard is for.
     */
    public readonly timePeriod: ActivityPeriod;

    /**
     * The current page that the leaderboard is on.
     */
    public readonly currentPage: number;
    /**
     * The total number of pages in the leaderboard.
     */
    public readonly totalPages: number;
    /**
     * Whether or not there is a next page in the leaderboard.
     */
    public readonly hasNextPage: boolean;
    /**
     * The generated HTML for the leaderboard.
     */
    public readonly html: string;

    constructor(guild: Guild, { activity_type, time_period, current_page, total_pages, has_next_page, html }: ActivityLeaderboard & GuildActivityLeaderboardQueryOptions) {
        super(guild);

        this.activityType = activity_type;
        this.timePeriod = time_period;

        this.currentPage = current_page;
        this.totalPages = total_pages;
        this.hasNextPage = has_next_page;
        this.html = html;
    }

    /**
     * Generates the card for the activity leaderboard by taking a screenshot of the provided html.
     */
    public async generateCard() {
        const browserlessUrl = new URL("/screenshot", BROWSERLESS_URL);

        const data = {
            html: this.html,
            selector: "body",

            setExtraHTTPHeaders: {
                Authorization: BOT_ENDPOINT_API_KEY
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

        const request = new Request(browserlessUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        try {
            const res = await fetch(request);

            if (!res.ok) {
                return errAsync(new RequestError({
                    message: `Request failed with status code ${res.status}.`,
                    response: res,
                    request
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
                        request
                    }));
                }
            }

            return okAsync(Buffer.from(await res.arrayBuffer()));
        } catch (e) {
            return errAsync(new RequestError({
                message: `Request failed.`,
                request
            }));
        }
    }
}