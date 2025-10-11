import { Readable } from 'stream';
import { Command, container } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { type ApplicationCommandOptionData, ApplicationCommandOptionType, ApplicationIntegrationType, AttachmentBuilder, InteractionContextType, MessageFlags } from 'discord.js';

@ApplyOptions<Command.Options>({
    description: 'Get information on a server member!'
})
export class ServerProfile extends Command {
    readonly _options: ApplicationCommandOptionData[] = [
        {
            type: ApplicationCommandOptionType.String,
            required: true,
            name: 'leaderboard',
            description: "The leaderboard you'd like to see.",
            choices: [
                { name: 'Chat Activity', value: 'chat' }
            ]
        },
        {
            type: ApplicationCommandOptionType.String,
            required: true,
            name: 'display',
            description: "What leaderboard data should be displayed.",
            choices: [
                { name: 'All Time', value: 'all' },
                { name: 'This Month', value: 'monthly' },
                { name: 'This Week', value: 'weekly' },
            ]
        }
    ];

    public override async registerApplicationCommands(registry: Command.Registry) {
        registry
            .registerChatInputCommand({
                name: this.name,
                description: this.description,
                options: this._options,
                dmPermission: false,
                contexts: [ InteractionContextType.Guild ],
                integrationTypes: [ ApplicationIntegrationType.GuildInstall ],
            });
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        if (!interaction.guild) return;

        await interaction.deferReply({ withResponse: true });

        const activityType = interaction.options.getString('leaderboard', true);
        const displayType = interaction.options.getString('display', true);

        const res = await container.api.guilds.generateGuildActivityLeaderboardCard(interaction.guild.id, {
            activity_type: activityType,
            time_period: displayType
        });

        if (res.isErr()) {
            return await interaction.editReply({
                content: 'Something went wrong while generating the leaderboard card.',
            });
        }

        const attachment = new AttachmentBuilder(res.value, { name: 'leaderboard.png' });

        return await interaction.editReply({ files: [ attachment ] });
    }
}
