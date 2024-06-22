import { ApplicationCommandOptionType, AttachmentBuilder, type ApplicationCommandSubCommandData } from 'discord.js';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';
import { UserError } from '@sapphire/framework';
import { LeaderboardStats } from '#lib/extensions/LeaderboardStats';

@ApplyOptions<Subcommand.Options>({
    description: 'Leaderboards relating to server statistics.',
    subcommands: [
        {
            name: 'activity',
            chatInputRun: 'getGuildActivityLeaderboard'
        }
    ]
})
export class RarityGrinder extends Subcommand {
    private readonly _groupOptions: ApplicationCommandSubCommandData[] = [
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'activity',
            description: 'Fetch activity leaderboard information for this server.',
            options: [
                {
                    type: ApplicationCommandOptionType.String,
                    name: 'type',
                    description: 'The leaderboard type. Default is all time.',
                    choices: [
                        { name: 'All Time', value: 'all' },
                        { name: 'This Month', value: 'monthly' }
                    ]
                }
            ]
        }
    ];

    public override async registerApplicationCommands(registry: Subcommand.Registry) {
        registry
            .registerChatInputCommand({
                name: this.name,
                description: this.description,
                options: this._groupOptions
            });
    }

    public async getGuildActivityLeaderboard(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return;

        const type = interaction.options.getString('type') || 'all';
        const { activity_tracking } = await this.container.api.getGuildSettings(interaction.guild.id);
        if (!activity_tracking) {
            throw new UserError({
                identifier: 'TRACKING_DISBALED',
                message: 'Activity tracking is not enabled for this guild.'
            });
        }

        const leaderboardStats = await this.container.api.getActivityLeaderboard(interaction.guildId!, '', type);
        if (!leaderboardStats) {
            throw new UserError({
                identifier: 'NO_LEADEARBOARD',
                message: 'There is no activity leaderboard available for this guild.'
            });
        }

        await interaction.deferReply({ fetchReply: true });

        const today = new Date();
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1);
        
        const leaderboard = new AttachmentBuilder(
            await new LeaderboardStats({
                headerImage: interaction.guild.iconURL({ forceStatic: true, size: 64 }) || '',
                mainHeader: interaction.guild.name,
                ...(type === 'all'
                    ? {
                        describeHeader: 'Top Activity Leaderboard',
                    }
                    : {
                        describeHeader: 'Monthly Activity Leaderboard',
                        otherHeader:  `Resets on ` + new Intl.DateTimeFormat('en-US', { dateStyle: 'short' }).format(lastDay) + ` @ ` + new Intl.DateTimeFormat('en-US', { timeStyle: 'long' }).format(lastDay)
                    }
                ),
                fields: {
                    holder: 'Member',
                    value: 'Activity Points'
                },
                stats: await Promise.all(leaderboardStats.map(async (s) => {
                    const member = await this.container.client.users.fetch(s.member_id, { force: true });
        
                    return {
                        rank: s.rank,
                        holder: `@${member.username}` || '? ? ?',
                        value: s.value
                    }
                })),
                pageNumber: 1,
                lastUpdated: new Date()
            }).draw(),
            { name: 'leaderboard.png' }
        );

        await interaction.editReply({ files: [leaderboard] });
    }
}