import CurrentActivityRole, { type GuildMemberCurrentActivityRole } from "./CurrentActivityRole";
import type Guild from "./Guild";
import type GuildMember from "./GuildMember";
import NextActivityRole, { type GuildMemberNextActivityRole } from "./NextActivityRole";

export type GuildMemberActivity = {
    rank: number;
    points: number;
    last_grant_epoch: number;
    is_on_cooldown: boolean;
    current_activity_role_ids: Array<string>;
    current_activity_role: GuildMemberCurrentActivityRole | null;
    next_activity_role: GuildMemberNextActivityRole | null;
};

export default abstract class BaseMemberActivity {
    public readonly guild: Guild;
    public readonly member: GuildMember

    public rank: number;
    public points: number;
    public lastGrantEpoch: number;
    public currentActivityRoles: Array<string>;
    public currentActivityRole: CurrentActivityRole | null;
    public nextActivityRole: NextActivityRole | null;

    constructor(guild: Guild, member: GuildMember, { rank, points, last_grant_epoch, current_activity_role_ids, current_activity_role, next_activity_role }: GuildMemberActivity) {
        this.guild = guild;
        this.member = member;

        this.rank = rank;
        this.points = points;
        this.lastGrantEpoch = last_grant_epoch;

        this.currentActivityRoles = current_activity_role_ids;

        this.currentActivityRole = current_activity_role && new CurrentActivityRole(current_activity_role);
        this.nextActivityRole = next_activity_role && new NextActivityRole(next_activity_role);
    }

    /**
     * Checks if the member is on a grant cooldown.
     */
    public get isOnCooldown() {
        return this.lastGrantEpoch + this.guild.chatActivity.cooldown > Date.now() / 1000;
    }

    /**
     * Compares an old activity role to the current activity role to
     * determine if the member has unlocked a new role.
     */
    public hasNewActivityRole(previousRole: CurrentActivityRole | null) {
        if (!previousRole && this.currentActivityRole)
            return true;

        if (previousRole && this.currentActivityRole && previousRole.roleId !== this.currentActivityRole.roleId)
            return true;

        return false;
    }
}