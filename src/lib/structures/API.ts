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
import type { DeepPartial } from '#lib/types/global';
import gql from 'gql-query-builder';
import { container } from '@sapphire/pieces';
import { GraphQLResponseErrors, type GraphQLErrorStructure } from '#lib/extensions/GraphQLResponseErrors';

export class TypicalAPI {
    protected readonly apiKey: string;
    protected readonly baseUrl: URL;

    /**
     * @param key Your API access key.
     */
    constructor(key: string) {
        this.apiKey = key;
        this.baseUrl = new URL('/bot/graphql', 'http://127.0.0.1:3000');
    }

    /**
     * Deep replace content from data.
     * @param data The current data.
     * @param newData The new data.
     * @returns {T} The updated data.
     */
    private deepReplace<Data = object>(data: Data, newData: DeepPartial<Data>): Data {
        const newKeys = Object.keys(newData);

        for (const key of newKeys) {
            const oldValue = data[key];
            const newValue = newData[key];
    
            if (oldValue === undefined || oldValue === null || newValue === undefined || newValue === null) continue;

            if (typeof oldValue === 'object' && typeof newValue === 'object') {
                if (Array.isArray(oldValue) && JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                    data[key] = newValue;
                }
                else {
                    data[key] = this.deepReplace(oldValue, newValue);
                }
            } 
            else if (oldValue !== newValue) {
                data[key] = newValue;
            }
        }

        return data;
    }

    /**
     * Add a value into the Redis cache.
     * @param key The key to add.
     * @param value The value to assign to the key.
     * @param ttl How long the data should remained cached.
     */
    private async updateCache<Data>(key: string, value: Data, ttl?: number) {
        container.cache.set(key, JSON.stringify(value),
            ttl ? { EX: ttl } : {}
        );
    }

    /**
     * Check if a key is in the Redis cache.
     * @param key The key to fetch.
     * @returns {Promise<boolean>}
     */
    private async isCached(key: string): Promise<boolean> {
        return await container.cache.exists(key).catch(() => 0) === 1
            ? true
            : false;
    }

    /**
     * Fetch content from the Redis cache.
     * @param key The key to fetch.
     * @returns {Promise<Data>}
     */
    private async fetchFromCache<Data>(key: string): Promise<Data> {
        const cached = await container.cache.get(key);

        /**
         * the null check here is overridden.
         * ideally you should be running isCache() to make sure it exists before fetching the data.
         * may refactor this to do it differently, it is technically another resource operation but it isn't a heavy one.
         */
        return JSON.parse(cached!) as Data;
    }

    /**
     * Run a query in the graphql api.
     * @param query The query to run
     * @param variables Any variables for the query.
     * @returns {Promise<Data>}
     */
    private async gql<Data>(query: string, variables?: { [k: string]: any }): Promise<Data> {
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                authorization: this.apiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({ query, variables })
        }).catch(() => null);

        if (!response) throw new Error('Fetch failed, the API may be down.');
        if (!response.ok) throw new Error(`Status code ${response.status}`);

        const { errors, data }: { errors?: GraphQLErrorStructure[]; data: Data } = await response.json();
        if (errors?.length) {
            throw new GraphQLResponseErrors(errors);
        };

        return data;
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
                        'user_limit'
                    ]
                },
            ]
        });

        const { GuildSettingsInfo } = await this.gql<{ GuildSettingsInfo: GuildSettingsInfo }>(query.query, query.variables);

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

        const { UpdateGuildActivityRoles } = await this.gql<{ UpdateGuildActivityRoles: UpdateGuildActivityRoles }>(mutation.query, mutation.variables);

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

        const { UpdateGuildSettings } = await this.gql<{ UpdateGuildSettings: UpdateGuildSettings }>(mutation.query, mutation.variables);

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
                'user_limit'
            ]
        });

        const { AddGuildVoiceRoomSettings } = await this.gql<{ AddGuildVoiceRoomSettings: AddGuildVoiceRoomSettings }>(mutation.query, mutation.variables);

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
                'user_limit'
            ]
        });

        const { RemoveGuildVoiceRoomSettings } = await this.gql<{ RemoveGuildVoiceRoomSettings: RemoveGuildVoiceRoomSettings }>(mutation.query, mutation.variables);

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
                'is_locked'
            ]
        });

        const { ActiveVoiceRoomInfo } = await this.gql<{ ActiveVoiceRoomInfo: ActiveVoiceRoomInfo }>(query.query, query.variables);

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
                'is_locked'
            ]
        });

        const { CreateGuildVoiceRoom } = await this.gql<{ CreateGuildVoiceRoom: CreateGuildVoiceRoom }>(mutation.query, mutation.variables);

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
                'is_locked'
            ]
        });

        const { ModifyGuildVoiceRoom } = await this.gql<{ ModifyGuildVoiceRoom: ModifyGuildVoiceRoom }>(mutation.query, mutation.variables);

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
                'origin_channel_id',
                'channel_id',
                'created_by_user_id',
                'is_locked'
            ]
        });

        const { DeleteGuildVoiceRoom } = await this.gql<{ DeleteGuildVoiceRoom: DeleteGuildVoiceRoom }>(mutation.query, mutation.variables);

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

        const { MemberProfileInfo } = await this.gql<{ MemberProfileInfo: MemberProfileInfo }>(query.query, query.variables);

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

        const { IncrementActivityPoints } = await this.gql<{ IncrementActivityPoints: IncrementActivityPoints }>(mutation.query, mutation.variables);

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

        const { GuildActivityLeaderboard } = await this.gql<{ GuildActivityLeaderboard: GuildActivityLeaderboard }>(query.query, query.variables);

        return GuildActivityLeaderboard;
    }
}