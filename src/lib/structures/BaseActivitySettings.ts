import GuildManager, { type GuildSettings } from './Guild';
import ActivityRole, { type GuildActivityRole } from './ActivityRole';

import { Collection } from 'discord.js';
import { okAsync, errAsync } from 'neverthrow';
import { request } from '#/lib/util/request';
import type { APIResponse, APIError } from "#/lib/types/api";

const { BOT_API_URL, BOT_ENDPOINT_API_KEY } = process.env;

export enum ActivityType {
    Chat = 'chat',
    Voice = 'voice'
};

export enum ActivityPeriod {
    AllTime = 'all',
    CurrentMonth = 'monthly',
    CurrentWeek = 'weekly',
};

export type GuildActivityTracking = {
    is_enabled: boolean;
    grant_amount: number;
    cooldown: number;
    activity_roles: Array<GuildActivityRole>;
    deny_roles: Array<string>;
};

export type GuildActivityRoleCreateOptions = {
    activity_type: ActivityType;
    role_id: string;
    required_points: number;
};

export type GuildActivityTrackingUpdateOptions = Partial<
    Omit<GuildActivityTracking, 'activity_roles' | 'deny_roles'>
>;

export default abstract class BaseActivitySettings {
    public readonly guild: GuildManager
    
    public isEnabled: boolean;
    public grantAmount: number;
    public cooldown: number;
    public activityRoles: Collection<string, ActivityRole>;
    public denyRoles: Array<string>;

    constructor(guild: GuildManager, { is_enabled, grant_amount, cooldown, activity_roles, deny_roles }: GuildActivityTracking) {
        this.guild = guild;

        this.isEnabled = is_enabled;
        this.grantAmount = grant_amount;
        this.cooldown = cooldown;

        this.activityRoles = new Collection<string, ActivityRole>();
        for (const role of activity_roles) {
            this.activityRoles.set(role.role_id, new ActivityRole(role));
        }

        this.denyRoles = deny_roles;
    }

    /**
     * Creates a new activity role for the guild.
     */
    public async createActivityRole({ activity_type, role_id, required_points }: GuildActivityRoleCreateOptions) {
        const res = await request<APIResponse<{}>, APIError>({
            url: new URL(`/v1/guild/${this.guild.id}/settings/activity-roles`, BOT_API_URL),
            method: 'POST',
            headers: {
                Authorization: BOT_ENDPOINT_API_KEY
            },
            body: { activity_type, role_id, required_points }
        });

        if (res.isOk()) {
            this.activityRoles.set(role_id, new ActivityRole({ role_id, required_points }));
            this.activityRoles = this.activityRoles.sort((a, b) => a.requiredPoints - b.requiredPoints);

            return okAsync(this);
        }

        return res;
    }
}
