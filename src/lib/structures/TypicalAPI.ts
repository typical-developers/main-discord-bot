import { container } from '@sapphire/pieces';
import type { DeepPartial } from '@/lib/types/global';
import { GraphQLResponseErrors, type GraphQLErrorStructure } from '@/lib/extensions/GraphQLResponseErrors';

export abstract class TypicalAPI {
    public baseUrl: URL;

    constructor() {
        this.baseUrl = new URL(process.env.DEV_DEPLOYMENT === 'true'
            ? 'http://127.0.0.1:3000'
            : 'https://api.typicaldevelopers.com'
        );
    }

    /**
     * Deep replace content from data.
     * @param data The current data.
     * @param newData The new data.
     * @returns {T} The updated data.
     */
    public deepReplace<Data = object>(data: Data, newData: DeepPartial<Data>): Data {
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
    public async updateCache<Data>(key: string, value: Data, ttl?: number) {
        container.cache.set(key, JSON.stringify(value),
            ttl ? { EX: ttl } : {}
        );
    }

    /**
     * Check if a key is in the Redis cache.
     * @param key The key to fetch.
     * @returns {Promise<boolean>}
     */
    public async isCached(key: string): Promise<boolean> {
        return await container.cache.exists(key).catch(() => 0) === 1
            ? true
            : false;
    }

    /**
     * Fetch content from the Redis cache.
     * @param key The key to fetch.
     * @returns {Promise<Data>}
     */
    public async fetchFromCache<Data>(key: string): Promise<Data> {
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
    public async gql<Data>(query: string, variables?: { [k: string]: any }, extraHeaders?: { [k: string]: any }): Promise<Data> {
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                // authorization: this.apiKey,
                'content-type': 'application/json',
                ...extraHeaders
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
}