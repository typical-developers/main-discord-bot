declare module Bun {
    interface Env {
        /** The API url. */
        API_URL: string;

        /** Whether or not the current deployment is a dev build. */
        DEV_DEPLOYMENT: 'true' | 'false';

        /** The Discord bot's token. */
        DISCORD_TOKEN: string;
        /** The API key for accessing the bot's backend. */
        BOT_ENDPOINT_API_KEY: string;
        /** The API secret for accessing the experience's backend. */
        EXPERIENCE_ENDPOINT_API_SECRET: string;
        /** The webhook for logging errors. */
        BOT_ERROR_WEBHOOK_URL: string;

        /** Redis Username */
        REDIS_USERNAME: string;
        /** Redis Password */
        REDIS_PASSWORD: string;
        /** Redis host (host:port) */
        REDIS_HOST: string;
    }
}
