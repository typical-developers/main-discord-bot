import type { WebhookClient } from 'discord.js';
import type { RedisClientType } from 'redis';
import type { BotGraphQLAPI } from '#lib/extensions/BotGraphQLAPI';
import type { ExperienceGraphQLAPI } from '#lib/extensions/ExperienceGraphQLAPI';

declare module '@sapphire/pieces' {
    interface Container {
        cache: RedisClientType
        /** Key for the backend api. */
        api: {
            bot: BotGraphQLAPI;
            experience: ExperienceGraphQLAPI;
        };
        /** Webhooks for logging stuff that happens on the client. */
        sentry: {
            /** Errors that happen. */
            errors: WebhookClient;
        };
    }
}
