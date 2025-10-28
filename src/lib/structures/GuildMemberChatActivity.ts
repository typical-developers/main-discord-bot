import BaseMemberActivity from "./BaseMemberActivity";
import type { GuildMemberProfile } from "./GuildMember";

import { request } from "#/lib/util/request";
import RequestError from "#/lib/extensions/RequestError";
import type { APIResponse, APIError } from "#/lib/types/api";
import { okAsync } from "neverthrow";
import CurrentActivityRole from "./CurrentActivityRole";
import NextActivityRole from "./NextActivityRole";

const { BOT_API_URL, BOT_ENDPOINT_API_KEY } = process.env;

export default class GuildMemberChatActivity extends BaseMemberActivity {
    private async _incrementPoints() {
        const res = await request<APIResponse<GuildMemberProfile>, APIError>({
            url: new URL(`/v1/guild/${this.guild.id}/member/${this.member.id}/chat-activity`, BOT_API_URL),
            method: 'PATCH',
            headers: {
                Authorization: BOT_ENDPOINT_API_KEY
            }
        });

        if (res.isErr()) return res;

        const { chat_activity } = res.value.data;

        this.rank = chat_activity.rank;
        this.points = chat_activity.points;
        this.lastGrantEpoch = chat_activity.last_grant_epoch;
        this.currentActivityRoles = chat_activity.current_activity_role_ids;
        this.currentActivityRole = chat_activity.current_activity_role && new CurrentActivityRole(chat_activity.current_activity_role);
        this.nextActivityRole = chat_activity.next_activity_role && new NextActivityRole(chat_activity.next_activity_role);

        return okAsync(this.member);
    }

    public async incrementPoints({ createNew }: { createNew?: boolean } = {}) {
        const res = await this._incrementPoints();

        if (res.isErr()) {
            if (res.error instanceof RequestError && res.error.response.status === 404) {
                if (!createNew) return res;

                const created = await this.guild.members.fetch(this.member.id, { createNew: true });
                if (created.isErr()) return created;

                return await this._incrementPoints();
            }

            return res;
        }

        return okAsync(this.member);
    }
}