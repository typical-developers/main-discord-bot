declare module Bun {
    interface Env {
        /**
         * The current deployment environment that the bot is running on.
         * @default 'production' This is the default to prevent accidents.
         */
        ENVIRONMENT: 'production' | 'development';
        /**
         * The Discord token for the bot.
         */
        DISCORD_TOKEN: string;
        /**
         * The Discord webhook url to push error information to.
         */
        BOT_ERROR_WEBHOOK_URL: string;

        /**
         * The base url for the public experience api.
         */
        PUBLIC_API_URL: string;
        
        /**
         * The base url for the bot's internal api.
         */
        BOT_API_URL: string;
        /**
         * The authorization for `BOT_API_URL`.
         */
        BOT_ENDPOINT_API_KEY: string;

        /**
         * The host for the Redis connection.
         */
        REDIS_HOST: string;
        /**
         * The port for the Redis connection.
         */
        REDIS_PORT: string;
        /**
         * The username to connect to the Redis instance.
         */
        REDIS_USERNAME: string;
        /**
         * The password, if nay, to connect to the Redis instance.
         * If there is no password, leave empty or put `nopass`.
         */
        REDIS_PASSWORD?: string;

        /**
         * The DB that should be used for caching.
         */
        
        REDIS_CACHE_DB: string;
        /**
         * The DB that should be used for @sapphire/plugin-scheduled-tasks
         */
        REDIS_TASKS_DB: string;

        /**
         * The URL for the browserless instance
         */
        BROWSERLESS_URL: string;
    }
}
