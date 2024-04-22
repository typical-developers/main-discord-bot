declare namespace NodeJS {
    interface ProcessEnv {
        /** Whether or not the current deployment is a dev build. */
        DEV_DEPLOYMENT: 'true' | 'false';

        /** The Discord bot's token. */
        DISCORD_TOKEN: string;
        /** The API key for accessing the bot's backend. */
        BOT_ENDPOINT_API_KEY: string;
    }
}
