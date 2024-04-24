import type { TypicalAPI } from '#lib/structures/API';
import { WebhookClient } from 'discord.js';

declare module '@sapphire/pieces' {
    interface Container {
        /** Key for the backend api. */
        api: TypicalAPI;
        /** Webhooks for logging stuff that happens on the client. */
        sentry: {
            /** Errors that happen. */
            errors: WebhookClient
        }
    }
}
