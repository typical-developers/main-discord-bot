import { ApplicationCommandOptionType, AttachmentBuilder, type ApplicationCommandSubCommandData } from 'discord.js';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';
import { OaklandsLeaderboardStats } from '#lib/extensions/OaklandsLeaderboard';

@ApplyOptions<Subcommand.Options>({
    description: 'Leaderboards relating to Oaklands statistics.',
    subcommands: [
        {
            name: 'monthly-sellers',
            chatInputRun: 'getTopMonthlyLeaderboard'
        },
        {
            name: 'daily-materials',
            chatInputRun: 'getDailyMaterialsLeaderboard'
        }
    ]
})
export class OaklandsLeaderboard extends Subcommand {
    private readonly _groupOptions: ApplicationCommandSubCommandData[] = [
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'monthly-sellers',
            description: 'Fetch the top 25 sellers for the month on Oaklands.'
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'daily-materials',
            description: 'Fetch the top 25 sold materials today in Oaklands.'
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

    private async bulkUserFetch(ids: string[]) {
        const url = new URL('/v1/users', 'https://users.roblox.com');

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                userIds: ids,
                excludeBannedUsers: false
            })
        });

        if (!response.ok) {
            return [];
        }

        const { data } = await response.json() as { data: {
            hasVerifiedBadge: boolean;
            id: number;
            name: string;
            displayName: string;
        }[]};

        return data;
    }

    public async getTopMonthlyLeaderboard(interaction: Subcommand.ChatInputCommandInteraction) {
        await interaction.deferReply({ fetchReply: true });

        const usersLeaderboard = await this.container.api.experience.fetchOaklandsUserCashEarned() || [];
        if (!usersLeaderboard?.length || usersLeaderboard.length < 15) {
            return await interaction.editReply({
                content: 'There is not enough leaderboard data yet for this month.'
            });
        }

        const userProfiles: { [key: string]: string } = (await this.bulkUserFetch(usersLeaderboard.map(({ user_id }) => user_id)))
            .reduce((acc, curr) => ({
                [curr.id.toString()]: curr.name,
                ...acc
            }), {});

        const formattedLeaderboard = usersLeaderboard
            .map(({ user_id, cash_amount }) => ({
                holder: `${`@${userProfiles[user_id]}` || user_id}`,
                value: `$${cash_amount.toLocaleString()}`
            }))
            .slice(0, 25);

        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        
        const nextMonth = new Date(today);
        nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1, 1);

        const leaderboard = new AttachmentBuilder(
            await new OaklandsLeaderboardStats({
                header: `This Month's Top ${formattedLeaderboard.length} Sellers`,
                resetTime: nextMonth,
                fields: {
                    holder: 'USER',
                    value: 'AMOUNT'
                },
                stats: formattedLeaderboard
            }).draw(),
            { name: 'top-sellers-leaderboard.png' }
        );

        await interaction.editReply({ files: [leaderboard] });
    }

    public async getDailyMaterialsLeaderboard(interaction: Subcommand.ChatInputCommandInteraction) {
        await interaction.deferReply({ fetchReply: true });

        const materialsLeaderboard = await this.container.api.experience.fetchOaklandsMaterialsCashEarned() || [];
        if (!materialsLeaderboard?.length || materialsLeaderboard.length < 15) {
            return await interaction.editReply({
                content: 'There is not enough leaderboard data yet for today.'
            });
        }

        const limitedLeaderboard = materialsLeaderboard
            .map(({ material_type, cash_amount }) => ({
                holder: material_type === 'ExampleTree'
                    ? 'Oak Tree'
                    : material_type.split(/(?=[A-Z])/).join(' '),
                value: `$${cash_amount.toLocaleString()}`
            }))
            .slice(0, 25);

        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        
        const tommorrow = new Date(today);
        tommorrow.setUTCDate(today.getUTCDate() + 1);

        const leaderboard = new AttachmentBuilder(
            await new OaklandsLeaderboardStats({
                header: `Today's Top ${limitedLeaderboard.length} Sold Materials`,
                resetTime: tommorrow,
                fields: {
                    holder: 'MATERIAL',
                    value: 'AMOUNT'
                },
                stats: limitedLeaderboard
            }).draw(),
            { name: 'top-materials-leaderboard.png' }
        );

        await interaction.editReply({ files: [leaderboard] });
    }
}