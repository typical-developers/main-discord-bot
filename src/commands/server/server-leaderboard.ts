import { Readable } from 'stream';
import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { type ApplicationCommandOptionData, ApplicationCommandOptionType, ApplicationIntegrationType, AttachmentBuilder, InteractionContextType, MessageFlags } from 'discord.js';
import { ImageProcessorErrorReference } from '#/lib/extensions/ImageProcessorError';

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
        const leaderboard = interaction.options.getString('leaderboard', true);
        const display = interaction.options.getString('display', true);

        const settings = await this.container.api.getGuildSettings(interaction.guildId!, { create: true });
        if (settings.isErr()) {
            // todo: error handling & logging
            return;
        }

        await interaction.deferReply({ withResponse: true });

        const card = await this.container.api.getGuildLeaderboardCard(interaction.guildId!, { activity_type: leaderboard, display });
        if (card.isErr()) {
            const err = card.error

            if (err.reference === ImageProcessorErrorReference.StatusNotOK) {
                await interaction.editReply({
                    content: 'Guild leaderboard card does not exist.',
                });
            }

            return;
        }
        const attachment = new AttachmentBuilder(Readable.from(card.value), { name: `${interaction.guildId!}_${display}-${leaderboard}-leaderboard.png` });

        return await interaction.editReply({
            files: [attachment]
        });
    }
}
