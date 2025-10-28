export type GuildMemberCurrentActivityRole = {
    role_id: string;
    accent: string;
    name: string;
    required_points: number;
};

export default class CurrentActivityRole {
    public roleId: string;
    public accent: string;
    public name: string;
    public requiredPoints: number;

    constructor({ role_id, accent, name, required_points }: GuildMemberCurrentActivityRole) {
        this.roleId = role_id;
        this.accent = accent;
        this.name = name;
        this.requiredPoints = required_points;
    }
}