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

export enum APIErrorCodes {
    InvalidRequestBody = "INVALID_REQUEST",

    GuildSettingsExists = "GUILD_ALREADY_EXISTS",
    GuildNotFound = "GUILD_NOT_FOUND",

    MemberNotInGuild = "MEMBER_NOT_IN_GUILD",
    MemberProfileNotFound = "MEMBER_NOT_FOUND",
    MemberProfileExists = "MEMBER_ALREADY_EXISTS",
    MemberOnGrantCooldown = "MEMBER_ON_COOLDOWN",
    ChatActivityTrackingDisabled = "CHAT_ACTIVITY_TRACKING_DISABLED",
    ActivityRoleExists = "ACTIVITY_ROLE_ALREADY_EXISTS",

    VoiceRoomLobbyExists = "VOICE_ROOM_LOBBY_ALREADY_EXISTS",
    VoiceRoomLobbyNotFound = "VOICE_ROOM_LOBBY_NOT_FOUND",
    VoiceRoomLobbyIsVoiceRoom = "VOICE_ROOM_LOBBY_IS_ACTIVE_VOICE_ROOM",
    VoiceRoomExists = "VOICE_ROOM_EXISTS",
    VoiceRoomNotFound = "VOICE_ROOM_NOT_FOUND",
}

export interface APIError extends BaseAPIResponse {
    /**
     * The message that the API returned due to an error.
     */
    message: APIErrorCodes;
};
