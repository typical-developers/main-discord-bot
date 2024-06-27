import type { TypicalAPI } from '#lib/structures/API';
import type { WebhookClient } from 'discord.js';
import type { RedisClientType } from 'redis';

declare module '@sapphire/pieces' {
    interface Container {
        cache: RedisClientType
        /** Key for the backend api. */
        api: TypicalAPI;
        /** Webhooks for logging stuff that happens on the client. */
        sentry: {
            /** Errors that happen. */
            errors: WebhookClient;
        };
    }
}
