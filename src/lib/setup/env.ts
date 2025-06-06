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
    DISCORD_TOKEN: z.string(),

    BOT_ENDPOINT_API_KEY: z.string(),
    EXPERIENCE_ENDPOINT_API_SECRET: z.string(),
    BOT_ERROR_WEBHOOK_URL: z.string().url(),

    REDIS_USERNAME: z.string(),
    REDIS_PASSWORD: z.string(),
    REDIS_HOST: z.string(),

    API_URL: z.string().url(),
    DEV_DEPLOYMENT: z.union([z.literal('true'), z.literal('false')]).default('false')
});

/**
 * Currently using process.env only to maintain compatibility with existing files
 *
 * TODO: Consider refactoring to use the typed env object directly for better type safety
 * const env = Env(envVariables);
 * console.log(env.DISCORD_TOKEN); // Fully typed access to env vars
 */

Env(envVariables);

// Typed proccess.env
declare global {
    namespace NodeJS {
        interface ProcessEnv extends z.infer<typeof envVariables> {}
    }
}

/**
 * If you prefer to use bun instead of node, you can use this instead:
 *
 * ```typescript
 * declare module 'bun' {
 *   interface Env extends z.infer<typeof envVariables> {}
 * }
 * ```
 */
