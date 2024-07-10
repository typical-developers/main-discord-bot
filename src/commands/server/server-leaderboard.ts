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
export class ServerLeaderboard extends Subcommand {
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
                        { name: 'This Month', value: 'monthly' },
                        { name: 'This Week', value: 'weekly' }
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
                options: this._groupOptions,
                dmPermission: false
            });
    }

    private leaderboardResetTime(time: Date) {
        return `Resets on ` +
                new Intl.DateTimeFormat('en-US', { dateStyle: 'short' }).format(time) +
                ` @ ` +
                new Intl.DateTimeFormat('en-US', { timeStyle: 'long' }).format(time)
    }

    private leaderboardHeaders(type: string) {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        switch (type) {
            case 'weekly': 
                const weekLastDay = new Date(today);
                weekLastDay.setUTCDate(today.getUTCDate() - today.getUTCDay() + (today.getUTCDay() === 0 ? 1 : 8));
                
                return {
                    describeHeader: 'Weekly Activity Leaderboard',
                    otherHeader:  this.leaderboardResetTime(weekLastDay)
                }
            case 'monthly':
                const monthLastDay = new Date(today);
                monthLastDay.setUTCMonth(monthLastDay.getUTCMonth() + 1, 1);

                return {
                    describeHeader: 'Monthly Activity Leaderboard',
                    otherHeader:  this.leaderboardResetTime(monthLastDay)
                }
            default: return {
                describeHeader: 'Top Activity Leaderboard',
            }
        }
    }

    public async getGuildActivityLeaderboard(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return;

        await interaction.deferReply({ fetchReply: true });

        const type = interaction.options.getString('type') || 'all';
        const { activity_tracking } = await this.container.api.bot.getGuildSettings(interaction.guild.id);
        if (!activity_tracking) {
            throw new UserError({
                identifier: 'TRACKING_DISBALED',
                message: 'Activity tracking is not enabled for this guild.'
            });
        }

        const leaderboardStats = await this.container.api.bot.getActivityLeaderboard(interaction.guild.id, '', type);
        if (!leaderboardStats) {
            throw new UserError({
                identifier: 'NO_LEADEARBOARD',
                message: 'There is no activity leaderboard available for this guild.'
            });
        }

        const leaderboard = new AttachmentBuilder(
            await new LeaderboardStats({
                headerImage: interaction.guild.iconURL({ forceStatic: true, size: 64 }) || '',
                mainHeader: interaction.guild.name,
                ...this.leaderboardHeaders(type),
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