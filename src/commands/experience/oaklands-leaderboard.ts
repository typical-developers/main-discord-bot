import { ApplicationCommandOptionType, AttachmentBuilder, type ApplicationCommandSubCommandData } from 'discord.js';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';
import { OaklandsLeaderboardStats } from '@/lib/extensions/OaklandsLeaderboard';
import { topMaterialsToday } from '@/lib/util/public-api';
import { generateOaklandsLeaderboard, getResetTime } from '@/lib/util/image-generators';

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
            description: 'Fetch the top 25 sold materials today in Oaklands.',
            options: [
                {
                    type: ApplicationCommandOptionType.String,
                    name: 'leaderboard',
                    description: 'The leaderboard type. Default is all time.',
                    choices: [
                        { name: 'Cash', value: 'cash' },
                        { name: 'Candy', value: 'candy2024' }
                    ]
                }
            ]
        }
    ];

    private readonly _currencyDetails: Record<string, { type: string; color: string; }> = {
        cash: { type: '$', color: '#37FF91' },
        candy2024: { type: '🍬', color: '#D82A40' }
    }

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

    private _getPositionAcronym(position: number) {
        switch (position) {
            case 1:
                return `1st`;
            case 2:
                return `2nd`;
            case 3:
                return `3rd`;
            default:
                return `${position}th`
        }
    }

    private _getPositionColor(position: number) {
        switch (position) {
            case 1:
                return `#ECD400`;
            case 2:
                return `#B1B1B1`;
            case 3:
                return `#F67600`;
            default:
                return null;
        }
    }

    private _generateRows(rows: Record<string, { position: number; name: string; value: number }>, currency: { type: string; color: string; }) {
        const values = Object.values(rows);

        const newRows = [];

        for (const row of values) {
            const positionAcronym = this._getPositionAcronym(row.position);
            const positionColor = this._getPositionColor(row.position);

            newRows.push({
                rank: {
                    value: positionAcronym,
                    customProperties: positionColor
                        ? { style: `color: ${positionColor}; width: 0;` }
                        : { style: "width: 0;" }
                },
                material: {
                    value: row.name,
                    ...(positionColor ? { customProperties: { style: `color: ${positionColor}` } } : {})
                },
                amount: {
                    value: `${currency.type}${row.value.toLocaleString()}`,
                    customProperties: { style: `color: ${currency.color}` }
                }
            });
        }

        return newRows;
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
            .map(({ user_id, cash_amount, currency_type }) => ({
                holder: `${`@${userProfiles[user_id]}` || user_id}`,
                value: `${currency_type === 'Candy2024'?'🍬':'$'}${cash_amount.toLocaleString()}`
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

        const currencyType = interaction.options.getString('leaderboard') || 'cash';

        const materials = await topMaterialsToday();
        if (!materials) {
            return await interaction.editReply({
                content: 'There was an issue fetching the materials leaderboard.'
            });
        }

        const materialLeaderboard = materials.leaderboards[currencyType];
        if (!materialLeaderboard) {
            return await interaction.editReply({
                content: 'There is no data for this leaderboard.'
            });
        }

        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const tommorrow = new Date(today);
        tommorrow.setUTCDate(today.getUTCDate() + 1);

        const leaderboard = new AttachmentBuilder(
            await generateOaklandsLeaderboard({
                title: "Today's Top 25 Sold Materials",
                resetTime: getResetTime(new Date(materials.reset_time)),
                columns: ['rank', 'material', 'amount'],
                rows: this._generateRows(materialLeaderboard, this._currencyDetails[currencyType]).slice(0, 25),
            }),
            { name: 'top-materials-leaderboard.png' }
        );

        await interaction.editReply({ files: [leaderboard] });
    }
}