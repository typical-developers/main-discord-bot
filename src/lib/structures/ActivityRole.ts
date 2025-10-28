export type GuildActivityRole = {
    role_id: string;
    required_points: number;
};

export default class ActivityRole {
    public readonly roleId: string;
    public readonly requiredPoints: number;

    constructor({ role_id, required_points }: GuildActivityRole) {
        this.roleId = role_id;
        this.requiredPoints = required_points;
    }
}