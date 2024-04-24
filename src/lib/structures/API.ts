import type { MemberProfileDetails } from '@typical-developers/api-types/graphql';
import { GraphQLResponseErrors } from '#lib/extensions/GraphQLResponseErrors';
import gql from 'gql-query-builder';

// TODO: Cache results and update them.

export class TypicalAPI {
    protected readonly apiKey: string;
    protected readonly baseUrl: URL;

    /**
     * @param key Your API access key.
     */
    constructor(key: string) {
        this.apiKey = key;
        this.baseUrl = new URL('/graphql', 'http://127.0.0.1:3000');
    }

    protected async query<Data extends Object>(query: string, variables?: object) {
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

        // TODO: Typeset errors better.
        const { errors, data }: { errors?: object[]; data: Data } = await response.json();
        if (errors?.length) {
            throw new GraphQLResponseErrors(errors);
        }

        return data;
    }

    public async getMemberProfile(guildId: string, memberId: string) {
        const query = gql.query({
            operation: 'MemberProfile',
            variables: { guild_id: { type: 'Snowflake', value: guildId }, member_id: { type: 'Snowflake', value: memberId } },
            fields: [
                'rank',
                'point_amount',
                'activity_card_style',
                {
                    current_activity_roles: ['role_id', 'required_points'],
                    next_activity_role: ['required_points'],
                    previous_activity_role: ['required_points']
                }
            ]
        });

        const { MemberProfile } = await this.query<{ MemberProfile: MemberProfileDetails | null }>(query.query, query.variables);
        return MemberProfile;
    }
}
