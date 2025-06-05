import { container } from '@sapphire/framework';
import { type RedisClientType, createClient } from 'redis';

const { REDIS_USERNAME, REDIS_PASSWORD, REDIS_HOST, REDIS_PORT, REDIS_CACHE_DB } = process.env

const cache: RedisClientType = createClient({
    url: `redis://${REDIS_USERNAME}:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}/${REDIS_CACHE_DB}`
});

await cache.connect();

container.cache = cache;
