import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { ApplicationCommandOptionType, ChannelType, ChatInputCommandInteraction, PermissionFlagsBits, TextChannel, type ApplicationCommandOptionData } from 'discord.js';

@ApplyOptions<Command.Options>({
    description: 'Set a slowmode for a chennl.'
})
export class ModerationSlowmode extends Command {
    private readonly _commandOptions: ApplicationCommandOptionData[] = [
        {
            type: ApplicationCommandOptionType.Number,
            name: 'duration',
            description: "How long the slowmode should be.",
            required: true,
        },
        {
            type: ApplicationCommandOptionType.Channel,
            name: 'channel',
            description: "The channel to have slowmode for (in seconds). Defaults to current.",
        },
        {
            type: ApplicationCommandOptionType.Number,
            name: 'auto-remove',
            description: "How long until the slowmode should automatically remove (in seconds).",
        }
    ]

    public override async registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand({
            name: process.env.DEV_DEPLOYMENT === 'true'
                ? `dev-${this.name}`
                : this.name,
            description: this.description,
            defaultMemberPermissions: [ PermissionFlagsBits.ManageMessages ],
            options: this._commandOptions
        });
    }

    private async _setSlowmode(interaction: ChatInputCommandInteraction, channel: TextChannel, duration: number) {
        const success = await channel.setRateLimitPerUser(duration).then(() => true).catch(() => false);
        
        if (!success)
            return await interaction.editReply({
                content: `Unable to set slowmode for <#${channel.id}>, do I have the correct permissions?`,
            });

        if (duration === 0) 
            return await interaction.editReply({
                content: `Successfully disabled the slowmode for <#${channel.id}>`,
            });

        return await interaction.editReply({
            content: `Successfully set the slowmode duration for <#${channel.id}> to ${duration}s.`,
        });
    }

    private async _createNewTask(payload: { guildId: string; channelId: string; previous: number; }, duration: number) {
        return await this.container.tasks.create(
            {
                name: 'RemoveSlowmode',
                payload: payload,
            },
            {
                repeated: false,
                delay: duration * 1000,
            }
        );
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction) {
        if (!interaction.channel) return;

        if (interaction.channel.type !== ChannelType.GuildText) 
            return await interaction.reply({
                content: "Unable to set the duration for the provided channel.",
                ephemeral: true,
            });

        await interaction.deferReply({ fetchReply: true, ephemeral: true });

        const duration = interaction.options.getNumber('duration', true);
        const setChannel = interaction.options.getChannel<ChannelType.GuildText>('channel', false);
        const autoRemove = interaction.options.getNumber('auto-remove', false);

        if (autoRemove) {
            if (autoRemove < duration) return await interaction.editReply({
                content: "The auto-remove duration must be the same as or greater than the duration.",
            });

            await this._createNewTask({
                guildId: interaction.guildId!,
                channelId: setChannel?.id ?? interaction.channelId!,
                previous: setChannel?.rateLimitPerUser ?? interaction.channel.rateLimitPerUser,
            }, autoRemove);
        }

        if (setChannel) {
            if (setChannel.type !== ChannelType.GuildText) 
                return await interaction.editReply({
                    content: "Unable to set the duration for the provided channel.",
                });

            return await this._setSlowmode(interaction, setChannel, duration);
        }

        return await this._setSlowmode(interaction, interaction.channel, duration);
    }
}
