import type {
    GuildSettings,
    GuildSettingsInput,
    UpdateGuildSettings,
    GuildSettingsInfo,
    ActivityRolesInput,
    UpdateGuildActivityRoles,
    CreateGuildVoiceRoom,
    ModifyGuildVoiceRoom,
    DeleteGuildVoiceRoom,
    ActiveVoiceRoomInfo,
    VoiceRoomDetails,
    ActiveVoiceRoomSettingsInput,
    VoiceRoomSettingsInput,
    MemberProfile,
    MemberProfileInfo,
    IncrementActivityPoints,
    GuildActivityLeaderboard,
    AddGuildVoiceRoomSettings,
    RemoveGuildVoiceRoomSettings
} from '@typical-developers/api-types/graphql';
import { container } from '@sapphire/pieces';
import gql from 'gql-query-builder';
import { TypicalAPI } from "#lib/structures/TypicalAPI";

export class BotGraphQLAPI extends TypicalAPI {
    protected readonly apiKey: string;

    constructor(key: string) {
        super();

        this.apiKey = key;
        this.baseUrl = new URL('/bot/graphql', this.baseUrl);
    }

    /**
     * Fetch the settings of a guild.
     * @param guildId The id for the guild.
     * @returns {Promise<GuildSettings>}
     */
    public async getGuildSettings(guildId: string): Promise<GuildSettings> {
        const key = `${guildId}`;
        if (await this.isCached(key))
            return await this.fetchFromCache<GuildSettings>(key);

        const query = gql.query({
            operation: 'GuildSettingsInfo',
            variables: { guild_id: { type: 'Snowflake!', value: guildId } },
            fields: [
                'activity_tracking',
                'activity_tracking_grant',
                'activity_tracking_cooldown',
                {
                    activity_roles: [
                        'role_id',
                        'required_points'
                    ],
                    voice_rooms: [
                        'voice_channel_id',
                        'user_limit',
                        'can_lock',
                        'can_rename',
                        'can_adjust_limit'
                    ]
                },
            ]
        });

        const { GuildSettingsInfo } = await this.gql<{ GuildSettingsInfo: GuildSettingsInfo }>(query.query, query.variables, { authorization: this.apiKey });

        /**
         * We return dummy data if it cant get the actual guild settings from the API.
         * It'll never cache this data, so when it is able to fetch it, it'll have something that's correct.
         */
        if (!GuildSettingsInfo) {
            return {
                activity_tracking: false,
                activity_tracking_grant: 1,
                activity_tracking_cooldown: 10,
                activity_roles: [],
                voice_rooms: []
            } as GuildSettings;
        }

        await this.updateCache<GuildSettingsInfo>(key, GuildSettingsInfo);
        return GuildSettingsInfo;
    }

    /**
     * Update guild activity roles.
     * @param guildId The id of the guild.
     * @param roles The roles to modify.
     * @returns {Promise<GuildSettings>}
     */
    public async updateGuildActivityRoles(guildId: string, roles: Partial<ActivityRolesInput>): Promise<GuildSettings> {
        const key = `${guildId}`;
        const currentSettings = await this.getGuildSettings(guildId);

        const mutation = gql.mutation({
            operation: 'UpdateGuildActivityRoles',
            variables: {
                guild_id: { type: 'Snowflake!', value: guildId },
                roles: { type: 'ActivityRolesInput!', value: roles }
            },
            fields: [
                'role_id',
                'required_points'
            ]
        });

        const { UpdateGuildActivityRoles } = await this.gql<{ UpdateGuildActivityRoles: UpdateGuildActivityRoles }>(mutation.query, mutation.variables, { authorization: this.apiKey });

        if (UpdateGuildActivityRoles) {
            const updatedSettings = this.deepReplace<GuildSettings>(currentSettings, { activity_roles: UpdateGuildActivityRoles });
            await this.updateCache<GuildSettings>(key, updatedSettings);
            
            return updatedSettings;
        }

        return currentSettings;
    }

    /**
     * Update settings for a guild.
     * @param guildId The guild to update settings for.
     * @param settings The settings to update.
     * @returns {Promise<UpdateGuildSettings>} The settings for the guild.
     */
    public async updateGuildSettings(guildId: string, settings: Partial<GuildSettingsInput>): Promise<UpdateGuildSettings> {
        const mutation = gql.mutation({
            operation: 'UpdateGuildSettings',
            variables: {
                guild_id: { type: 'Snowflake!', value: guildId },
                settings: { type: 'GuildSettingsInput!', value: settings }
            },
            fields: Object.keys(settings)
        });

        const { UpdateGuildSettings } = await this.gql<{ UpdateGuildSettings: UpdateGuildSettings }>(mutation.query, mutation.variables, { authorization: this.apiKey });

        if (UpdateGuildSettings) {
            await container.cache.del(`${guildId}`);
            await this.getGuildSettings(guildId);
        }

        return UpdateGuildSettings;
    }

    public async addVoiceRoom(guildId: string, channelId: string, settings: VoiceRoomSettingsInput) {
        const mutation = gql.mutation({
            operation: 'AddGuildVoiceRoomSettings',
            variables: {
                guild_id: { type: 'Snowflake!', value: guildId },
                channel_id: { type: 'Snowflake!', value: channelId },
                settings: { type: 'VoiceRoomSettingsInput!', value: settings }
            },
            fields: [
                'insert_epoch',
                'guild_id',
                'voice_channel_id',
                'user_limit',
                'can_lock',
                'can_rename',
                'can_adjust_limit'
            ]
        });

        const { AddGuildVoiceRoomSettings } = await this.gql<{ AddGuildVoiceRoomSettings: AddGuildVoiceRoomSettings }>(mutation.query, mutation.variables, { authorization: this.apiKey });

        if (AddGuildVoiceRoomSettings) {
            await container.cache.del(`${guildId}`);
            await this.getGuildSettings(guildId);
        }

        return AddGuildVoiceRoomSettings;
    }

    public async removeVoiceRoom(guildId: string, channelId: string) {
        const mutation = gql.mutation({
            operation: 'RemoveGuildVoiceRoomSettings',
            variables: {
                guild_id: { type: 'Snowflake!', value: guildId },
                channel_id: { type: 'Snowflake!', value: channelId }
            },
            fields: [
                'insert_epoch',
                'guild_id',
                'voice_channel_id',
                'user_limit',
                'can_lock',
                'can_rename',
                'can_adjust_limit'
            ]
        });

        const { RemoveGuildVoiceRoomSettings } = await this.gql<{ RemoveGuildVoiceRoomSettings: RemoveGuildVoiceRoomSettings }>(mutation.query, mutation.variables, { authorization: this.apiKey });

        if (RemoveGuildVoiceRoomSettings) {
            await container.cache.del(`${guildId}`);
            await this.getGuildSettings(guildId);
        }

        return RemoveGuildVoiceRoomSettings;
    }

    /**
     * Get an active voice room.
     * @param guildId The guild to fetch a room for.
     * @param channelId The channel in the guild.
     * @returns {Promise<ActiveVoiceRoomInfo>} The current voice room information.
     */
    public async getVoiceRoom(guildId: string, channelId: string): Promise<ActiveVoiceRoomInfo> {
        const key = `${guildId}:${channelId}`;
        if (await this.isCached(key))
            return await this.fetchFromCache<VoiceRoomDetails>(key);

        const query = gql.query({
            operation: 'ActiveVoiceRoomInfo',
            variables: {
                guild_id: { type: 'Snowflake!', value: guildId },
                channel_id: { type: 'Snowflake!', value: channelId }
            },
            fields: [
                'insert_epoch',
                'origin_channel_id',
                'channel_id',
                'created_by_user_id',
                'current_owner_id',
                'is_locked'
            ]
        });

        const { ActiveVoiceRoomInfo } = await this.gql<{ ActiveVoiceRoomInfo: ActiveVoiceRoomInfo }>(query.query, query.variables, { authorization: this.apiKey });

        if (ActiveVoiceRoomInfo) {
            await this.updateCache<VoiceRoomDetails>(key, ActiveVoiceRoomInfo);
        }

        return ActiveVoiceRoomInfo;
    }

    /**
     * Create a custom voice room in a guild.
     * @param guildId The guild to create a channel for.
     * @param originId The channel where the voice room creation originated from.
     * @param channelId The channel that was created.
     * @param creatorId The user that created the room.
     * @returns {Promise<CreateGuildVoiceRoom>} The original voice room details.
     */
    public async createVoiceRoom(guildId: string, originId: string, channelId: string, creatorId: string): Promise<CreateGuildVoiceRoom> {
        const mutation = gql.mutation({
            operation: 'CreateGuildVoiceRoom',
            variables: {
                guild_id: { type: 'Snowflake!', value: guildId },
                origin_channel_id: { type: 'Snowflake!', value: originId },
                channel_id: { type: 'Snowflake!', value: channelId },
                created_by_user_id: { type: 'Snowflake!', value: creatorId }
            },
            fields: [
                'insert_epoch',
                'origin_channel_id',
                'channel_id',
                'created_by_user_id',
                'current_owner_id',
                'is_locked'
            ]
        });

        const { CreateGuildVoiceRoom } = await this.gql<{ CreateGuildVoiceRoom: CreateGuildVoiceRoom }>(mutation.query, mutation.variables, { authorization: this.apiKey });

        if (CreateGuildVoiceRoom)
            await this.updateCache<VoiceRoomDetails>(`${guildId}:${channelId}`, CreateGuildVoiceRoom);

        return CreateGuildVoiceRoom;
    }

    /**
     * Update settings for a voice room.
     * @param guildId The 
     * @param channelId 
     * @param settings 
     * @returns {Promise<ModifyGuildVoiceRoom>} The original voice room details.
     */
    public async updateVoiceRoom(guildId: string, channelId: string, settings: ActiveVoiceRoomSettingsInput): Promise<ModifyGuildVoiceRoom> {
        const mutation = gql.mutation({
            operation: 'ModifyGuildVoiceRoom',
            variables: {
                guild_id: { type: 'Snowflake!', value: guildId },
                channel_id: { type: 'Snowflake!', value: channelId },
                settings: { type: 'ActiveVoiceRoomSettingsInput!', value: settings }
            },
            fields: [
                'insert_epoch',
                'origin_channel_id',
                'channel_id',
                'created_by_user_id',
                'current_owner_id',
                'is_locked'
            ]
        });

        const { ModifyGuildVoiceRoom } = await this.gql<{ ModifyGuildVoiceRoom: ModifyGuildVoiceRoom }>(mutation.query, mutation.variables, { authorization: this.apiKey });

        if (ModifyGuildVoiceRoom)
            await this.updateCache<VoiceRoomDetails>(`${guildId}:${channelId}`, ModifyGuildVoiceRoom);

        return ModifyGuildVoiceRoom;
    }

    /**
     * Delete a voice room.
     * @param guildId The id of the guild.
     * @param channelId The id of the channel.
     * @returns {Promise<DeleteGuildVoiceRoom>} The original voice room details.
     */
    public async deleteVoiceRoom(guildId: string, channelId: string): Promise<DeleteGuildVoiceRoom> {
        const mutation = gql.mutation({
            operation: 'DeleteGuildVoiceRoom',
            variables: {
                guild_id: { type: 'Snowflake!', value: guildId },
                channel_id: { type: 'Snowflake!', value: channelId },
            },
            fields: [
                'insert_epoch',
                'origin_channel_id',
                'channel_id',
                'created_by_user_id',
                'current_owner_id',
                'is_locked'
            ]
        });

        const { DeleteGuildVoiceRoom } = await this.gql<{ DeleteGuildVoiceRoom: DeleteGuildVoiceRoom }>(mutation.query, mutation.variables, { authorization: this.apiKey });

        if (DeleteGuildVoiceRoom)
            await container.cache.del(`${guildId}:${channelId}`);

        return DeleteGuildVoiceRoom;
    }

    /**
     * Get the profile of a guild member.
     * @param guildId The id of the guild.
     * @param memberId The id of the member.
     * @returns {Promise<MemberProfile | null>} The member's profile.
     */
    public async getMemberProfile(guildId: string, memberId: string): Promise<MemberProfile | null> {
        const key = `${guildId}:${memberId}`;
        if (await this.isCached(key))
            return this.fetchFromCache<MemberProfile>(key);

        const query = gql.query({
            operation: 'MemberProfileInfo',
            variables: {
                guild_id: { type: 'Snowflake!', value: guildId },
                member_id: { type: 'Snowflake!', value: memberId }
            },
            fields: [
                'card_style', {
                activity_info: [
                    'rank',
                    'points',
                    'last_grant_epoch', {
                    progression: [
                        'remaining_progress', {
                        current_roles: [
                            'role_id',
                            'required_points'
                        ],
                        next_role: [
                            'role_id',
                            'required_points'
                        ]}
                    ]}
                ]}
            ]
        });

        const { MemberProfileInfo } = await this.gql<{ MemberProfileInfo: MemberProfileInfo }>(query.query, query.variables, { authorization: this.apiKey });

        if (MemberProfileInfo) 
            await this.updateCache<MemberProfile>(key, MemberProfileInfo, 30 * 60);

        return MemberProfileInfo || null;
    }

    /**
     * Increment the points of a member.
     * @param guildId The id of the guild.
     * @param memberId The member in the guild.
     * @param amount The amount of points to add.
     * @param cooldown The cooldown for granting points.
     * @returns {Promise<IncrementActivityPoints>} The member's updated profile.
     */
    public async incrementActivityPoints(guildId: string, memberId: string, amount: number, cooldown: number): Promise<IncrementActivityPoints> {
        if (!this.isCached(`${guildId}:${memberId}`))
            await this.getMemberProfile(guildId, memberId);

        const mutation = gql.mutation({
            operation: 'IncrementActivityPoints',
            variables: {
                guild_id: { type: 'Snowflake!', value: guildId },
                member_id: { type: 'Snowflake!', value: memberId },
                points: { type: 'Int!', value: amount },
                cooldown: { type: 'Int!', value: cooldown }
            },
            fields: [
                'card_style', {
                activity_info: [
                    'rank',
                    'points',
                    'last_grant_epoch', {
                    progression: [
                        'remaining_progress', {
                        current_roles: [
                            'role_id',
                            'required_points'
                        ],
                        next_role: [
                            'role_id',
                            'required_points'
                        ]}
                    ]}
                ]}
            ]
        });

        const { IncrementActivityPoints } = await this.gql<{ IncrementActivityPoints: IncrementActivityPoints }>(mutation.query, mutation.variables, { authorization: this.apiKey });

        if (IncrementActivityPoints) 
            await this.updateCache<MemberProfile>(`${guildId}:${memberId}`, IncrementActivityPoints, 30 * 60);

        return IncrementActivityPoints;
    }

    /**
     * Fetch the activity leaderboard of a guild.
     * @param guildId The id of the guild.
     * @param cursor The page cursor (TODO: API does not support page cursors yet).
     * @param type The type of leaderboard to fetch.
     * @returns {Promise<GuildActivityLeaderboard>} The guild activity leaderboard information.
     */
    public async getActivityLeaderboard(guildId: string, cursor: string = '', type: string = 'all'): Promise<GuildActivityLeaderboard> {
        const query = gql.query({
            operation: 'GuildActivityLeaderboard',
            variables: {
                guild_id: { type: 'Snowflake!', value: guildId },
                leaderboard_type: { type: 'String', value: type }
            },
            fields: [
                'member_id',
                'rank',
                'value'
            ]
        });

        const { GuildActivityLeaderboard } = await this.gql<{ GuildActivityLeaderboard: GuildActivityLeaderboard }>(query.query, query.variables, { authorization: this.apiKey });

        return GuildActivityLeaderboard;
    }
}