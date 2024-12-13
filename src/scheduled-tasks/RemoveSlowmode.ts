import { ScheduledTask } from '@sapphire/plugin-scheduled-tasks';
import { ChannelType } from 'discord.js';
import TaskError from '@/lib/extensions/TaskError';

export class RemoveSlowmode extends ScheduledTask {
    public constructor(context: ScheduledTask.LoaderContext, options: ScheduledTask.Options) {
        super(context, { ...options });
    }

    public async run(payload: { guildId: string; channelId: string; previous?: number; }) {
        console.log(payload);

        const guild = await this.container.client.guilds.fetch(payload.guildId);
        const channel = await guild.channels.fetch(payload.channelId, { force: true });

        if (!guild || !channel) throw new TaskError({ task: 'RemoveSlowmode', payload, message: 'The guild/channel does not exist.' });
        if (channel.type !== ChannelType.GuildText) return;

        if (payload.previous) {
            await channel.setRateLimitPerUser(payload.previous).catch(() => ({}));
        }
        else {
            await channel.setRateLimitPerUser(0).catch(() => ({}));
        }
    }
}