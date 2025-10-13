export interface BaseAPIResponse {
    /**
     * Whether or not the API request was successful.
     */
    success: boolean;
}

export interface APIResponse<T> extends BaseAPIResponse {
    /**
     * The data that the API returned.
     */
    data: T;
};

export interface APIError extends BaseAPIResponse {
    /**
     * The message that the API returned due to an error.
     */
    message: string;
};

export interface GuildActivityRoles {
    role_id: string;
    required_points: number;
};

export interface GuildActivityTracking {
    is_enabled: boolean;
    grant_amount: number;
    cooldown: number;
    activity_roles: Array<GuildActivityRoles>;
    deny_roles: Array<string>;
};

export interface GuildVoiceRoomLobby {
    channel_id: string;
    user_limit: number;
    can_rename: boolean;
    can_lock: boolean;
    can_adjust_limit: boolean;
};

export type GuildSettings = {
    chat_activity: GuildActivityTracking;
    voice_room_lobbies: Array<GuildVoiceRoomLobby>;
};

export type GuildActivityTrackingUpdate = {
    chat_activity?: Partial<GuildActivityTracking>;
};

export type GuildActivityRoleCreate = {
    activity_type: string;
    role_id: string;
    required_points: number;
};

export type GuildActivityLeaderboardQuery = {
    activity_type?: string;
    time_period?: string;
}

export type MemberActivity = {
    rank: number;
    points: number;
    is_on_cooldown: boolean;

    current_activity_role_ids: Array<string>;

    current_activity_role: {
        role_id: string;
        accent: string;
        name: string;
        required_points: number;
    } | null;

    next_activity_role: {
        current_progress: number;
        required_points: number;
    } | null;
};

export type MemberProfile = {
    display_name: string;
    username: string;
    avatar_url: string;

    card_url: number;
    chat_activity: MemberActivity;
};

export type MemberProfileMigrate = {
    to_member_id: string;
};