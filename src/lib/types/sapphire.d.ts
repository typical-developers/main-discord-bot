import type { WebhookClient } from 'discord.js';
import type { RedisClientType } from 'redis';
import type { BotGraphQLAPI } from '#lib/extensions/BotGraphQLAPI';

declare module '@sapphire/pieces' {
    interface Container {
        cache: RedisClientType
        /** Key for the backend api. */
        api: {
            bot: BotGraphQLAPI;
        };
        /** Webhooks for logging stuff that happens on the client. */
        sentry: {
            /** Errors that happen. */
            errors: WebhookClient;
        };
    }
}
