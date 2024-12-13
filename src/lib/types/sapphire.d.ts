import type { WebhookClient, VoiceState } from 'discord.js';
import type { RedisClientType } from 'redis';
import type { BotGraphQLAPI } from '@/lib/extensions/BotGraphQLAPI';
import type { ExperienceGraphQLAPI } from '@/lib/extensions/ExperienceGraphQLAPI';
import type HTMLImageProcessor from '@/lib/structures/HTMLImageProcessor';
import * as PublicAPI from '@/lib/util/public-api';
import * as BotAPI from '@/lib/util/bot-api';
import * as ImageGenerators from '@/lib/util/image-generators';
import * as RedisUtil from '@/lib/util/redis';

declare module '@sapphire/pieces' {
    interface Container {
        imageProcessor: HTMLImageProcessor;
        imageGenerators: typeof ImageGenerators;
        cache: {
            client: RedisClientType
        } & typeof RedisUtil;
        api: typeof BotAPI;
        experience: typeof PublicAPI;
        /** Webhooks for logging stuff that happens on the client. */
        sentry: {
            /** Errors that happen. */
            errors: WebhookClient;
        };
    }
}

declare module '@sapphire/plugin-scheduled-tasks' {
	interface ScheduledTasks {
		IncrementVoiceActivity: { guildId: string; channelId: string; memberId: string; };
        RemoveSlowmode: { guildId: string; channelId: string; previous?: number; };
	}
}