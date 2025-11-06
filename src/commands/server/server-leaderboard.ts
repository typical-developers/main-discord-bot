import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { type ApplicationCommandOptionData, ApplicationCommandOptionType, ApplicationIntegrationType, AttachmentBuilder, InteractionContextType } from 'discord.js';
import type { ActivityPeriod, ActivityType } from '#/lib/structures/BaseActivitySettings';
import { leaderboardPagination } from '#/lib/util/buttons';
import { APIErrorCodes } from '#/lib/types/api';
import APIRequestError from '#/lib/extensions/APIRequestError';

@ApplyOptions<Command.Options>({
    description: 'Get information on a server member!'
})
export class ServerLeaderboard extends Command {
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
        },
        {
            type: ApplicationCommandOptionType.Number,
            required: false,
            name: 'page',
            description: "The page of the leaderboard to display.",
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

        const settings = await this.container.api.guilds.fetch(interaction.guild.id, { createNew: true });
        if (settings.isErr()) {
            this.container.logger.error(settings.error);
            return await interaction.editReply({ content: 'Something went wrong while generating the leaderboard card.' });
        }

        const { chatActivity } = settings.value;
        const activityType = interaction.options.getString('leaderboard', true) as ActivityType;
        const displayType = interaction.options.getString('display', true) as ActivityPeriod;
        const page = interaction.options.getNumber('page') || 1;

        if (activityType === 'chat' && !chatActivity.isEnabled) {
            return await interaction.editReply({ content: 'Chat activity tracking is not enabled for this guild.' });
        }

        const leaderboard = await settings.value.getActivityLeaderboard({ page, activity_type: activityType, time_period: displayType });
        if (leaderboard.isErr()) {
            if (APIRequestError.isAPIError(leaderboard.error) && leaderboard.error.isErrorCode(APIErrorCodes.LeaderboardNoRows)) {
                return await interaction.editReply({ content: 'The leaderboard currently has no rows.' });
            }

            this.container.logger.error(leaderboard.error);
            return await interaction.editReply({ content: 'Something went wrong while generating the leaderboard card.' });
        }

        const card = await leaderboard.value.generateCard();
        if (card.isErr()) {
            this.container.logger.error(card.error);
            return await interaction.editReply({ content: 'Something went wrong while generating the leaderboard card.' });
        }

        const attachment = new AttachmentBuilder(card.value, { name: 'leaderboard.png' });
        return await interaction.editReply({
            files: [ attachment ],
            components: [ leaderboardPagination(leaderboard.value) ]
        });
    }
}
