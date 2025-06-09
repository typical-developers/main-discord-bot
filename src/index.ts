import '@sapphire/plugin-logger/register';
import '@sapphire/plugin-scheduled-tasks/register'
import '#/lib/setup/initialize';

import { ApplicationCommandRegistries, LogLevel, RegisterBehavior, SapphireClient } from '@sapphire/framework';
import { GatewayIntentBits, Partials } from 'discord.js';

const client = new SapphireClient({
    logger: { level: LogLevel.Info },
    loadDefaultErrorListeners: false,
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [ Partials.Message, Partials.Channel, Partials.Reaction, Partials.User ],
    tasks: {
        bull: { connection: {
            host: process.env.REDIS_HOST,
            port: parseInt(process.env.REDIS_PORT),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_TASKS_DB)
        }}    
    }
});

await client.login();

ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(RegisterBehavior.BulkOverwrite);
