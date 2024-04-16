declare namespace NodeJS {
    interface ProcessEnv {
        DISCORD_TOKEN: string;

        DEV_DEPLOYMENT: 'true' | 'false';
    }
}