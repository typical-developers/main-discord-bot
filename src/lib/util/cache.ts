import Redis from "ioredis";
import { okAsync, errAsync } from "neverthrow";

const { REDIS_HOST, REDIS_PORT, REDIS_USERNAME, REDIS_PASSWORD, REDIS_CACHE_DB } = process.env;

const client = (REDIS_HOST && REDIS_PORT && REDIS_CACHE_DB
    ? new Redis({
        host: REDIS_HOST,
        port: parseInt(REDIS_PORT),
        username: REDIS_USERNAME,
        password: REDIS_PASSWORD,
        db: parseInt(REDIS_CACHE_DB)
    })
    : null
)

if (!client) {
    throw new Error("Unable to create Redis client.");
}

type SetOptions = {
    ttl?: number;
    selector?: string;
}

async function jsonGet<T>(key: string) {
    try {
        const json = await client?.call("JSON.GET", key) as string;
        if (!json) throw new Error("Value not cached.");
        
        return okAsync(JSON.parse(json) as T);
    } catch (e) {
        return errAsync(e);
    }
}

async function jsonSet<T>(key: string, value: T, selector: string, options?: SetOptions) {
    try {
        await client?.call("JSON.SET", key, selector, JSON.stringify(value));

        if (options?.ttl) {
            await client?.call("EXPIRE", key, options.ttl);
        }

        return okAsync(true);
    } catch (e) {
        console.log(e);
        return errAsync(e);
    }
}

export default {
    jsonGet,
    jsonSet
};