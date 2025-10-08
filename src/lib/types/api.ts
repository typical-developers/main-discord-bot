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