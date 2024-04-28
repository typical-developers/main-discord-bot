import type { GuildSettings, GuildSettingsInput, IncrementActivityPoints, MemberProfileInfo, UpdateGuildSettings, GuildSettingsInfo } from '@typical-developers/api-types/graphql';
import NodeCache from 'node-cache';
import gql from 'gql-query-builder';
import { GraphQLResponseErrors } from '#lib/extensions/GraphQLResponseErrors';
import { DeepPartial } from '#lib/types/global';

export class TypicalAPI {
    protected readonly apiKey: string;
    protected readonly baseUrl: URL;
    public readonly cache: { [key: string]: NodeCache } = {
        guildSettings: new NodeCache(),
        memberProfiles: new NodeCache({ stdTTL: 600 })
    };

    /**
     * @param key Your API access key.
     */
    constructor(key: string) {
        this.apiKey = key;
        this.baseUrl = new URL('/graphql', 'http://127.0.0.1:3000');
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
    
            if (!oldValue || !newValue) continue;

            if (typeof oldValue === 'object' && typeof newValue === 'object') {
                if (Array.isArray(oldValue) && JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                    data[key] = newValue;
                } else {
                    data[key] = this.deepReplace(oldValue, newValue);
                }
            } else if (oldValue !== newValue) {
                data[key] = newValue;
            }
        }

        return data;
    }
    
    /**
     * Update settings for a guild.
     * @param guildId The guild to update settings for.
     * @param settings The settings to update.
     * @returns {Promise<UpdateGuildSettings>} The settings for the guild.
     */
    public async updateGuildSettings(guildId: string, settings: Partial<GuildSettingsInput>): Promise<UpdateGuildSettings> {
        // Force cache incase they have yet to be cached.
        if (!this.cache.guildSettings.get<GuildSettingsInput>(guildId)) await this.getGuildSettings(guildId);

        const mutation = gql.mutation({
            operation: 'UpdateGuildSettings',
            variables: {
                guild_id: { type: 'Snowflake!', value: guildId },
                settings: { type: 'GuildSettingsInput!', value: settings }
            },
            /**
             * We return the fields we update so we can recache them.
             * A function will be added whenever stacking is done.
             */
            fields: Object.keys(settings)
        });

        const { UpdateGuildSettings } = await this.gql<{ UpdateGuildSettings: UpdateGuildSettings }>(mutation.query, mutation.variables);

        if (UpdateGuildSettings) {
            const current = this.cache.guildSettings.get<GuildSettings>(guildId) || await this.getGuildSettings(guildId);
            const updated = this.deepReplace<GuildSettings>(current, UpdateGuildSettings);

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
            const current = this.cache.memberProfiles.get<MemberProfileInfo>(`${guildId}_${memberId}`) || await this.getMemberProfile(guildId, memberId);
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
            fields: ['activity_tracking', 'activity_tracking_grant', 'activity_tracking_cooldown']
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
                activity_roles: []
            } as GuildSettings;
        }

        this.cache.guildSettings.set<GuildSettings>(`${guildId}`, GuildSettingsInfo);
        return GuildSettingsInfo;
    }

    /**
     * Get the profile of a guild member.
     * @param guildId
     * @param memberId
     * @returns {Promise<MemberProfileInfo | null>}
     */
    public async getMemberProfile(guildId: string, memberId: string): Promise<MemberProfileInfo | null> {
        const cached = this.cache.memberProfiles.get<MemberProfileInfo>(`${guildId}_${memberId}`);
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

        // Caches the member profile if it exists.
        if (MemberProfileInfo) {
            this.cache.memberProfiles.set<MemberProfileInfo>(`${guildId}_${memberId}`, MemberProfileInfo);
        }

        return MemberProfileInfo;
    }
}
