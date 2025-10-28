import type { WebhookClient } from 'discord.js';
import type { RedisClientType } from 'redis';
import type { BotGraphQLAPI } from '#/lib/extensions/BotGraphQLAPI';
import type { ExperienceGraphQLAPI } from '#/lib/extensions/ExperienceGraphQLAPI';
import type BotAPI from '#/lib/structures/BotAPI';

declare module '@sapphire/pieces' {
    interface Container {
        cache: RedisClientType;
        /** Key for the backend api. */
        api: BotAPI;
        /** Webhooks for logging stuff that happens on the client. */
        sentry: {
            /** Errors that happen. */
            errors: WebhookClient;
        };
    }
}
