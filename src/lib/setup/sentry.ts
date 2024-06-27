import { container } from '@sapphire/pieces';
import { WebhookClient } from 'discord.js';

container.sentry = {
    errors: new WebhookClient({ url: process.env.BOT_ERROR_WEBHOOK_URL })
};
