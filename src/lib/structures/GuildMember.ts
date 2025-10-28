import type Guild from "./Guild";
import GuildMemberChatActivity from "./GuildMemberChatActivity";
import type { GuildMemberActivity } from "./BaseMemberActivity";

import { okAsync, errAsync } from "neverthrow";
import RequestError from "#/lib/extensions/RequestError";

const { BOT_API_URL, BOT_ENDPOINT_API_KEY, BROWSERLESS_URL } = process.env;

export type GuildMemberProfile = {
    display_name: string;
    username: string;
    avatar_url: string;

    card_style: number;
    chat_activity: GuildMemberActivity;
};

export default class GuildMember {
    public readonly id: string;
    public readonly guild: Guild;

    public readonly chatActivity: GuildMemberChatActivity;

    constructor(memberId: string, guild: Guild, { chat_activity }: GuildMemberProfile) {
        this.id = memberId;
        this.guild = guild;

        this.chatActivity = new GuildMemberChatActivity(this.guild, this, chat_activity);;
    }

    public async generateProfileCard() {
        const browserlessUrl = new URL("/screenshot", BROWSERLESS_URL);
        const url = new URL(`/v1/guild/${this.guild.id}/member/${this.id}/profile-card`, BOT_API_URL);

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
}