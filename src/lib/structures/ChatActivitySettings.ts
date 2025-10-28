import BaseActivitySettings, { type GuildActivityTracking, type GuildActivityRoleCreateOptions, type GuildActivityTrackingUpdateOptions, ActivityType, type GuildActivityLeaderboardQueryOptions } from './BaseActivitySettings';
import { type GuildSettings } from './Guild';
import ActivityRole, { type GuildActivityRole } from './ActivityRole';

import { okAsync, errAsync } from 'neverthrow';
import { Collection } from 'discord.js';
import { request } from '#/lib/util/request';
import type { APIResponse, APIError } from "#/lib/types/api";

const { BOT_API_URL, BOT_ENDPOINT_API_KEY } = process.env;

export type GuildChatActivityTracking = GuildActivityTracking & {};

export type GuildChatActivityTrackingUpdateOptions = GuildActivityTrackingUpdateOptions & {};

export default class ChatActivitySettings extends BaseActivitySettings {
    public override async createActivityRole({ role_id, required_points }: Omit<GuildActivityRoleCreateOptions, 'activity_type'>) {
        return super.createActivityRole({
            activity_type: ActivityType.Chat,
            role_id, required_points
        });
    }

    public async updateSettings(options: GuildChatActivityTrackingUpdateOptions) {
        const res = await request<APIResponse<GuildSettings>, APIError>({
            url: new URL(`/v1/guild/${this.guild.id}/settings/activity`, BOT_API_URL),
            method: 'PATCH',
            headers: {
                Authorization: BOT_ENDPOINT_API_KEY
            },
            body: { chat_activity: options }
        });

        if (res.isOk()) {
            const { is_enabled, grant_amount, cooldown, activity_roles, deny_roles } = res.value.data.chat_activity;

            this.isEnabled = is_enabled;
            this.grantAmount = grant_amount;
            this.cooldown = cooldown;

            this.activityRoles = new Collection<string, ActivityRole>();
            for (const { role_id, required_points } of activity_roles) {
                const role = new ActivityRole({ role_id, required_points });
                this.activityRoles.set(role.roleId, role);
            }
            
            this.denyRoles = deny_roles;
        } else {
            return errAsync(res.error);
        }

        return okAsync(this);
    }
}