import { z, type ZodTypeAny } from 'zod';

/**
 * Validates and type-checks environment variables using a Zod schema.
 *
 * This function ensures that all required environment variables are present and correctly typed.
 * If validation fails, the process will exit with an error message.
 *
 * @param schema - Zod schema defining the structure and types of environment variables
 * @param env - Optional environment object to validate (defaults to process.env)
 * @returns Validated and typed environment object
 * @throws Exits process if validation fails
 * @example
 * ```typescript
 * const schema = z.object({
 *   DISCORD_TOKEN: z.string(),
 *   PORT: z.number()
 * });
 *
 * const env = Env(schema);
 * console.log(env.DISCORD_TOKEN); // Fully typed access to env vars
 * ```
 *
 */
export function Env<T extends ZodTypeAny>(schema: T, env: Record<string, unknown> = process.env): z.infer<T> {
    const result = schema.safeParse(env);
    if (!result.success) {
        console.error('❌ Invalid environment variables:', result.error.format());
        process.exit(1); // Exit the process if validation fails to prevent further execution.
    }

    return result.data;
}

const envVariables = z.object({
    /* The current deployment environment that the bot is running on.
     * @default 'production' This is the default to prevent accidents.
     */
    ENVIRONMENT: z.union([z.literal('production'), z.literal('development')]),

    /**
     * The Discord token for the bot.
     */
    DISCORD_TOKEN: z.string(),

    /**
     * The Discord webhook url to push error information to.
     */
    BOT_ERROR_WEBHOOK_URL: z.string(),

    /**
     * The base url for the public experience api.
     */
    PUBLIC_API_URL: z.string(),

    /**
     * The base url for the bot's internal api.
     */
    BOT_API_URL: z.string(),

    /**
     * The authorization for `BOT_API_URL`.
     */
    BOT_ENDPOINT_API_KEY: z.string(),

    /**
     * The host for the Redis connection.
     */
    REDIS_HOST: z.string(),

    /**
     * The port for the Redis connection.
     */
    REDIS_PORT: z.string(),

    /**
     * The username to connect to the Redis instance.
     */
    REDIS_USERNAME: z.string(),

    /**
     * The password, if nay, to connect to the Redis instance.
     * If there is no password, leave empty or put `nopass`.
     */
    REDIS_PASSWORD: z.string().optional(),

    /**
     * The DB that should be used for caching.
     */
    REDIS_CACHE_DB: z.string(),

    /**
     * The DB that should be used for @sapphire/plugin-scheduled-tasks
     */
    REDIS_TASKS_DB: z.string(),

    /**
     * The chrome websocket connection url.
     */
    CHROME_WS_URL: z.string()
});

/**
 * Currently using process.env only to maintain compatibility with existing files
 *
 * TODO: Consider refactoring to use the typed env object directly for better type safety and getting the jsdoc comments
 * const env = Env(envVariables);
 * console.log(env.DISCORD_TOKEN); // Fully typed access to env vars
 */
Env(envVariables);

// Typed proccess.env
declare module 'bun' {
    interface Env extends z.infer<typeof envVariables> {}
}
