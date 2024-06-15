/**
 * TODO: This caching is stupid. Move it to the Redis cache.
 * It makes no sense to do caching this way. Just cache all of the data? It expires anyways, like wtf?
 * It also makes types very uncertain of themselves.
 */

import type {
    GuildSettings,
    MemberProfile,
    IncrementActivityPoints,
    MemberProfileInfo,
    UpdateGuildSettings,
    GuildSettingsInfo,
    GuildActivityLeaderboard,
    CreateGuildVoiceRoom,
    DeleteGuildVoiceRoom,
    ActiveVoiceRoomInfo,
    VoiceRoomDetails,
    VoiceRoomSettingsInput,
    ModifyGuildVoiceRoom,
    ActivityRolesInput,
    UpdateGuildActivityRoles
} from '@typical-developers/api-types/graphql';
import NodeCache from 'node-cache';
import gql from 'gql-query-builder';
import { GraphQLResponseErrors } from '#lib/extensions/GraphQLResponseErrors';
import { DeepPartial } from '#lib/types/global';

export class TypicalAPI {
    protected readonly apiKey: string;
    protected readonly baseUrl: URL;
    public readonly cache: { [key: string]: NodeCache } = {
        guildSettings: new NodeCache(),
        memberProfiles: new NodeCache({ stdTTL: 600 }),
        voiceRooms: new NodeCache()
    };

    /**
     * @param key Your API access key.
     */
    constructor(key: string) {
        this.apiKey = key;
        this.baseUrl = new URL('/bot/graphql', 'http://127.0.0.1:3000');
    }

    /**
     * Run a query in the graphql api.
     * @param query The query to run
     * @param variables Any variables for the query.
     * @returns {Promise<Data>}
     */
    public async gql<Data>(query: string, variables?: object): Promise<Data> {
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                authorization: this.apiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({ query, variables })
        }).catch(() => null);

        if (!response) {
            throw new Error('Fetch failed. API may be down.');
        }

        if (!response.ok) {
            throw new Error(`Status code ${response.status}.`);
        }

        const { errors, data }: { errors?: object[]; data: Data } = await response.json();
        if (errors?.length) {
            throw new GraphQLResponseErrors(errors);
        }

        return data;
    }

    /**
     * Deep replace content from data.
     * @param data The current data.
     * @param newData The new data.
     * @returns {T} The updated data.
     */
    private deepReplace<T = object>(data: T, newData: DeepPartial<T>): T {
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
    
    private deepKeys<T = object>(data: DeepPartial<T>): Array<string | { [key: string]: string[] }> {
        const allKeys = Object.keys(data).reduce((acc, curr) => {
            if (typeof data[curr] === 'object') {
                if (acc[curr]) return acc; // We already have these keys.

                return [ ...acc, ...this.deepKeys(data[curr]) ];
            }

            if (acc?.includes(curr)) {
                return acc;
            }

            return [ ...acc, curr ];
        }, [] as Array<string | { [key: string]: string[] }>);

        return allKeys;
    }

    /**
     * Get an active voice room.
     * @param guildId The guild to fetch a room for.
     * @param channelId The channel in the guild.
     */
    public async getVoiceRoom(guildId: string, channelId: string) {
        const cached = this.cache.voiceRooms.get<VoiceRoomDetails>(channelId);
        if (cached) return cached;

        const query = gql.query({
            operation: 'ActiveVoiceRoomInfo',
            variables: {
                guild_id: { type: 'Snowflake!', value: guildId },
                channel_id: { type: 'Snowflake!', value: channelId }
            },
            fields: [
                'origin_channel_id',
                'channel_id',
                'created_by_user_id',
                'is_locked'
            ]
        });

        const { ActiveVoiceRoomInfo } = await this.gql<{ ActiveVoiceRoomInfo: ActiveVoiceRoomInfo }>(query.query, query.variables);

        if (ActiveVoiceRoomInfo) {
            this.cache.voiceRooms.set<VoiceRoomDetails>(channelId, ActiveVoiceRoomInfo);
        }

        return ActiveVoiceRoomInfo;
    }

    /**
     * Create a custom voice room in a guild.
     * @param guildId The guild to create a channel for.
     * @param originId The channel where the voice room creation originated from.
     * @param channelId The channel that was created.
     * @param creatorId The user that created the room.
     * @returns 
     */
    public async createVoiceRoom(guildId: string, originId: string, channelId: string, creatorId: string) {
        const mutation = gql.mutation({
            operation: 'CreateGuildVoiceRoom',
            variables: {
                guild_id: { type: 'Snowflake!', value: guildId },
                origin_channel_id: { type: 'Snowflake!', value: originId },
                channel_id: { type: 'Snowflake!', value: channelId },
                created_by_user_id: { type: 'Snowflake!', value: creatorId }
            },
            fields: [
                'origin_channel_id',
                'channel_id',
                'created_by_user_id',
                'is_locked'
            ]
        });

        const { CreateGuildVoiceRoom } = await this.gql<{ CreateGuildVoiceRoom: CreateGuildVoiceRoom }>(mutation.query, mutation.variables);

        if (CreateGuildVoiceRoom) {
            this.cache.voiceRooms.set<VoiceRoomDetails>(channelId, CreateGuildVoiceRoom);
        }

        return CreateGuildVoiceRoom;
    }

    public async updateVoiceRoom(guildId: string, channelId: string, settings: VoiceRoomSettingsInput) {
        if (!this.cache.voiceRooms.get<VoiceRoomDetails>(channelId)) await this.getVoiceRoom(guildId, channelId);

        const mutation = gql.mutation({
            operation: 'ModifyGuildVoiceRoom',
            variables: {
                guild_id: { type: 'Snowflake!', value: guildId },
                channel_id: { type: 'Snowflake!', value: channelId },
                settings: { type: 'VoiceRoomSettings!', value: settings }
            },
            /**
             * We return the fields we update so we can recache them.
             * A function will be added whenever stacking is done.
             */
            fields: Object.keys(settings)
        });

        const { ModifyGuildVoiceRoom } = await this.gql<{ ModifyGuildVoiceRoom: ModifyGuildVoiceRoom }>(mutation.query, mutation.variables);

        if (ModifyGuildVoiceRoom) {
            const current = this.cache.voiceRooms.get<VoiceRoomDetails>(channelId);
            const updated = this.deepReplace<VoiceRoomDetails>(current!, ModifyGuildVoiceRoom);

            this.cache.voiceRooms.set<VoiceRoomDetails>(`${channelId}`, updated);
        }

        return await this.getVoiceRoom(guildId, channelId);
    }

    public async deleteVoiceRoom(guildId: string, channelId: string) {
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

        this.cache.voiceRooms.del(channelId);

        return DeleteGuildVoiceRoom;
    }

    public async updateGuildActivityRoles(guildId: string, roles: Partial<ActivityRolesInput>) {
        if (!this.cache.guildSettings.get<GuildSettings>(guildId)) await this.getGuildSettings(guildId);

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
            const current = this.cache.guildSettings.get<GuildSettings>(guildId);
            const updated = this.deepReplace<GuildSettings>(current!, { activity_roles: UpdateGuildActivityRoles });

            this.cache.guildSettings.set<GuildSettings>(`${guildId}`, updated);
        }

        return UpdateGuildActivityRoles;
    }

    /**
     * Update settings for a guild.
     * @param guildId The guild to update settings for.
     * @param settings The settings to update.
     * @returns {Promise<UpdateGuildSettings>} The settings for the guild.
     */
    public async updateGuildSettings(guildId: string, settings: Partial<GuildSettings>): Promise<UpdateGuildSettings> {
        // Force cache incase they have yet to be cached.
        if (!this.cache.guildSettings.get<GuildSettings>(guildId)) await this.getGuildSettings(guildId);

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
            const current = this.cache.guildSettings.get<GuildSettings>(guildId);
            const updated = this.deepReplace<GuildSettings>(current!, UpdateGuildSettings);

            this.cache.guildSettings.set<GuildSettings>(`${guildId}`, updated);
        }

        return UpdateGuildSettings;
    }

    /**
     * Increment the points of a member.
     * @param guildId The id of the guild.
     * @param memberId The member in the guild.
     * @param amount The amount of points to add.
     * @param cooldown The cooldown for granting points.
     * @returns {Promise<IncrementActivityPoints>}
     */
    public async incrementActivityPoints(guildId: string, memberId: string, amount: number, cooldown: number): Promise<IncrementActivityPoints> {
        if (!this.cache.memberProfiles.get<MemberProfileInfo>((`${guildId}_${memberId}`))) await this.getMemberProfile(guildId, memberId);

        const mutation = gql.mutation({
            operation: 'IncrementActivityPoints',
            variables: {
                guild_id: { type: 'Snowflake!', value: guildId },
                member_id: { type: 'Snowflake!', value: memberId },
                points: { type: 'Int!', value: amount },
                cooldown: { type: 'Int!', value: cooldown }
            },
            fields: [{
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

        if (IncrementActivityPoints) {
            const current = this.cache.memberProfiles.get<MemberProfileInfo>(`${guildId}_${memberId}`);
            const updated = this.deepReplace<MemberProfileInfo>(current, IncrementActivityPoints);

            this.cache.memberProfiles.set<MemberProfileInfo>(`${guildId}_${memberId}`, updated);
        }

        return IncrementActivityPoints;
    }

    /**
     * Fetch the settings of a guild.
     * @param guildId The id for the guild.
     * @returns {Promise<GuildSettings>}
     */
    public async getGuildSettings(guildId: string): Promise<GuildSettings> {
        const cached = this.cache.guildSettings.get<GuildSettings>(guildId);
        if (cached) return cached;

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

        this.cache.guildSettings.set<GuildSettings>(`${guildId}`, GuildSettingsInfo);
        return GuildSettingsInfo;
    }

    /**
     * 
     * @param guildId 
     * @param cursor 
     * @param type 
     * @returns {Promise<GuildActivityLeaderboard>}
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

    /**
     * Get the profile of a guild member.
     * @param guildId
     * @param memberId
     * @returns {Promise<MemberProfile>}
     */
    public async getMemberProfile(guildId: string, memberId: string): Promise<MemberProfileInfo> {
        const cached = this.cache.memberProfiles.get<MemberProfile>(`${guildId}_${memberId}`);
        if (cached) return cached;

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

        if (MemberProfileInfo) {
            this.cache.memberProfiles.set<MemberProfileInfo>(`${guildId}_${memberId}`, MemberProfileInfo);
        }

        return MemberProfileInfo;
    }
}
