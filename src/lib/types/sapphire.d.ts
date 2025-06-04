import type { WebhookClient } from 'discord.js';
import type { RedisClientType } from 'redis';
import type { BotGraphQLAPI } from '#/lib/extensions/BotGraphQLAPI';
import type { ExperienceGraphQLAPI } from '#/lib/extensions/ExperienceGraphQLAPI';
import type HTMLImageProcessor from '#/lib/structures/HTMLImageProcessor';

declare module '@sapphire/pieces' {
    interface Container {
        imageProcessor: HTMLImageProcessor;
        cache: RedisClientType;
        /** Key for the backend api. */
        api: {
        };
        /** Webhooks for logging stuff that happens on the client. */
        sentry: {
            /** Errors that happen. */
            errors: WebhookClient;
        };
    }
}
