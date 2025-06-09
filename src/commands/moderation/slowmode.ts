import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { ApplicationCommandOptionType, ChannelType, ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits, TextChannel, type APIApplicationCommandChannelOption, type ApplicationCommandData, type ApplicationCommandOptionData } from 'discord.js';

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
        // {
        //     type: ApplicationCommandOptionType.Number,
        //     name: 'auto-remove',
        //     description: "How long until the slowmode should automatically remove (in seconds).",
        // }
    ]

    public override async registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand({
            name: this.name,
            description: this.description,
            defaultMemberPermissions: [ PermissionFlagsBits.AddReactions ],
            options: this._commandOptions,
            dmPermission: false
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

    public override async chatInputRun(interaction: ChatInputCommandInteraction) {
        if (!interaction.channel) return;

        if (interaction.channel.type !== ChannelType.GuildText) 
            return await interaction.reply({
                content: "Unable to set the duration for the provided channel.",
                flags: [ MessageFlags.Ephemeral ],
            });

        await interaction.deferReply({ withResponse: true, flags: [ MessageFlags.Ephemeral ] });

        const setChannel = interaction.options.getChannel<ChannelType.GuildText>('channel', false);
        const duration = interaction.options.getNumber('duration', true);

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
