import type {
    OaklandsMaterialsCashEarned,
    OaklandsUserCashEarned
} from '@typical-developers/api-types/graphql';
import gql from 'gql-query-builder';
import { TypicalAPI } from "@/lib/structures/TypicalAPI";

export class ExperienceGraphQLAPI extends TypicalAPI {
    protected readonly apiKey: string;

    /**
     * @param key Your API access key.
     */
    constructor(key: string) {
        super();

        this.apiKey = key;
        this.baseUrl = new URL('/experience/graphql', process.env.DEV_DEPLOYMENT === 'true'
            ? 'http://127.0.0.1:3000'
            : 'https://api.typicaldevelopers.com'
        );

        this.baseUrl.searchParams.set('secret', key);
    }

    public async fetchOaklandsMaterialsCashEarned() {
        const query = gql.query({
            operation: 'OaklandsMaterialsCashEarned',
            fields: [
                'material_type',
                'cash_amount',
                'currency_type'
            ]
        });

        const { OaklandsMaterialsCashEarned } = await this.gql<{ OaklandsMaterialsCashEarned: OaklandsMaterialsCashEarned }>(query.query);
        return OaklandsMaterialsCashEarned;
    }

    public async fetchOaklandsUserCashEarned() {
        const query = gql.query({
            operation: 'OaklandsUserCashEarned',
            fields: [
                'user_id',
                'cash_amount',
                'currency_type'
            ]
        });

        const { OaklandsUserCashEarned } = await this.gql<{ OaklandsUserCashEarned: OaklandsUserCashEarned }>(query.query);
        return OaklandsUserCashEarned;
    }
}