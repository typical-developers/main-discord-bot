import { GraphQLREsponseErrors } from '#lib/extensions/GraphQLResponseErrors';
import type { MemberProfileDetails } from '@typical-developers/api-types/graphql';
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
            method: "POST",
            headers: {
                'authorization': this.apiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({ query, variables })
        });

        // TODO: Typeset errors better.
        const { errors, data }: { errors?: any[], data: Data } = await response.json();
        if (errors?.length) {
            throw new GraphQLREsponseErrors(errors);
        }

        return data;
    }

    public async getMemberProfile(guildId: string, memberId: string) {
        const query = gql.query({
            operation: 'member_profile',
            variables: { guild_id: guildId, member_id: memberId },
            fields: [
                'rank',
                'point_amount', {
                current_activity_roles: [
                    'role_id',
                    'required_points'
                ],
                next_activity_role: [
                    'required_points'
                ],
                previous_activity_role: [
                    'required_points'
                ]
            }]
        });

        const { member_profile } = await this.query<{ member_profile: MemberProfileDetails | null }>(query.query, query.variables);
        return member_profile;
    }
}
