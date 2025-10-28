export type GuildMemberNextActivityRole = {
    current_progress: number;
    required_points: number;
};

export default class NextActivityRole {
    public currentProgress: number;
    public requiredPoints: number;

    constructor({ current_progress, required_points }: GuildMemberNextActivityRole) {
        this.currentProgress = current_progress;
        this.requiredPoints = required_points;
    }
}