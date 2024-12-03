import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';
import {
    ApplicationCommandOptionType,
    ApplicationIntegrationType,
    AttachmentBuilder,
    InteractionContextType,
    type ApplicationCommandSubCommandData,
    type ApplicationCommandSubGroupData
} from 'discord.js';
import { usersInfoFromIds } from 'openblox/classic/users';
import { generateClassicShop, generateOaklandsLeaderboard, getResetTime } from '@/lib/util/image-generators';
import { fetchStore, topMaterialsToday, topUsersMonthly, joinUrl } from '@/lib/util/public-api';

@ApplyOptions<Subcommand.Options>({
    description: 'Manage settings for the current guild.',
    subcommands: [
        { name: 'classic-shop', chatInputRun: 'classicShop' },
        {
            name: 'leaderboards',
            type: 'group',
            entries: [
                { name: 'daily-materials', chatInputRun: 'dailyMaterialsLeaderboard' },
                { name: 'monthly-sellers', chatInputRun: 'monthlySellersLeaderboard' }
            ]
        },
    ]
})
export class Settings extends Subcommand {
    private readonly _options: (ApplicationCommandSubCommandData | ApplicationCommandSubGroupData)[] = [
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'classic-shop',
            description: 'Fetch the current classic shop.',
        },
        {
            type: ApplicationCommandOptionType.SubcommandGroup,
            name: 'leaderboards',
            description: "Fetch an Oakland\'s leaderboard.",
            options: [
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: 'daily-materials',
                    description: 'Fetch the current top daily materials.',
                    options: [{
                        type: ApplicationCommandOptionType.String,
                        name: 'type',
                        description: 'The leaderboard type. Default is Cash.',
                        choices: [
                            { name: 'Cash', value: 'Cash' },
                            { name: 'Snowflakes', value: 'Snowflakes2024' }
                        ]
                    }],
                },
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: 'monthly-sellers',
                    description: 'Fetch the current top monthly sellers.',
                    options: [{
                        type: ApplicationCommandOptionType.String,
                        name: 'type',
                        description: 'The leaderboard type. Default is Cash.',
                        choices: [
                            { name: 'Cash', value: 'Cash' },
                            { name: 'Snowflakes', value: 'Snowflakes2024' }
                        ]
                    }],
                }
            ]
        },
    ];

    public override async registerApplicationCommands(registry: Subcommand.Registry) {
        registry
            .registerChatInputCommand({
                name: this.name,
                description: this.description,
                options: this._options,
                contexts: [
                    InteractionContextType.BotDM,
                    InteractionContextType.Guild,
                    InteractionContextType.PrivateChannel,
                ],
                integrationTypes: [
                    ApplicationIntegrationType.GuildInstall,
                    ApplicationIntegrationType.UserInstall,
                ]
            });
    }

    public async classicShop(interaction: Subcommand.ChatInputCommandInteraction) {
        await interaction.deferReply({ fetchReply: true });

        const shop = await fetchStore('classic-shop');

        if (!shop) {
            return interaction.editReply('Unable to fetch the Oaklands Classic Shop at this time, try again later.');
        }

        const resetTime = getResetTime(new Date(shop.reset_time || Date.now()))
        const attachment = new AttachmentBuilder(
            await generateClassicShop({
                resetTime, items: shop.shop_items
                    .filter((item) => item.identifier !== 'GiftOfEmotion')
                    .map((item) => ({
                        thumbnail: joinUrl(item.image),
                        name: item.name,
                        price: item.price
                    }))
            }),
            { name: 'classic-shop.png' }
        );

        await interaction.editReply({ files: [attachment] });
    }

    private readonly _currencyDetails: Record<string, { type: string; color: string; }> = {
        cash: { type: '$', color: '#37FF91' },
        candy2024: { type: '🍬', color: '#D82A40' },
        snowflakes2024: { type: '❄️', color: '#85F3FF' },
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

    private _generateLeaderboardRows<T extends string>(rows: { position: number; key: { name: T; value: any; }; amount: number; }[], currency: { type: string; color: string; }) {
        // The types for this are genuinely a mess, but I don't care.

        const newRows: ({
            rank: { value: string; customProperties: { style: string; }; };
            amount: { value: string; customProperties: { style: string; }; }; } &
            { [key in T]: { value: any; customProperties?: object; }; }
        )[] = [];

        for (const row of rows) {
            const positionAcronym = this._getPositionAcronym(row.position);
            const positionColor = this._getPositionColor(row.position);

            const newRow = {
                rank: {
                    value: positionAcronym,
                    customProperties: positionColor
                        ? { style: `color: ${positionColor}; width: 0;` }
                        : { style: "width: 0;" }
                },
                [row.key.name]: {
                    value: row.key.value,
                    ...(positionColor ? { customProperties: { style: `color: ${positionColor}` } } : {})
                },
                amount: {
                    value: `${currency.type} ${row.amount.toLocaleString()}`,
                    customProperties: { style: `color: ${currency.color}` }
                },
            } as ({
                rank: { value: string; customProperties: { style: string; }; };
                amount: { value: string; customProperties: { style: string; }; }; } &
                { [key in T]: { value: any; customProperties?: object; }; }
            )

            newRows.push(newRow);  
        }

        return newRows;
    }

    public async dailyMaterialsLeaderboard(interaction: Subcommand.ChatInputCommandInteraction) {
        await interaction.deferReply({ fetchReply: true });
        const currencyType = interaction.options.getString('type') || 'Cash';

        const materialsLeaderboard = await topMaterialsToday(currencyType);
        if (!materialsLeaderboard) 
            return await interaction.editReply({
                content: 'There was an issue fetching the materials leaderboard.'
            });

        const leaderboard = new AttachmentBuilder(
            await generateOaklandsLeaderboard({
                title: `Today\'s Top Sold Materials`,
                resetTime: getResetTime(new Date(materialsLeaderboard.reset_time)),
                columns: ['rank', 'material', 'amount'],
                rows: this._generateLeaderboardRows<'material'>(materialsLeaderboard.leaderboard.slice(0, 25).map((l) => ({
                    position: l.position,
                    key: { name: 'material', value: l.name },
                    amount: l.value
                })), this._currencyDetails[currencyType.toLowerCase()])
            })
        );

        return await interaction.editReply({ files: [leaderboard] });
    }

    public async monthlySellersLeaderboard(interaction: Subcommand.ChatInputCommandInteraction) {
        await interaction.deferReply({ fetchReply: true });
        const currencyType = interaction.options.getString('type') || 'Cash';

        const playersLeaderboard = await topUsersMonthly(currencyType, 25);
        if (!playersLeaderboard) 
            return await interaction.editReply({
                content: 'There was an issue fetching the player\'s leaderboard.'
            });

        const players = await usersInfoFromIds({ userIds: playersLeaderboard.leaderboard.map(({ user_id }) => parseInt(user_id)) }).catch(() => null);
        const profiles =  Object.entries(players?.data || {})
            .reduce((acc, [id, profile]) => ({ [id]: profile?.name || id, ...acc }), {} as { [key: string]: string })

        const leaderboard = new AttachmentBuilder(
            await generateOaklandsLeaderboard({
                title: `This Month's Top Sellers`,
                resetTime: getResetTime(new Date(playersLeaderboard.reset_time), true),
                columns: ['rank', 'user', 'amount'],
                rows: this._generateLeaderboardRows<'user'>(playersLeaderboard.leaderboard.map((l) => ({
                    position: l.position,
                    key: { name: 'user', value: profiles[l.user_id] },
                    amount: l.cash_amount
                })), this._currencyDetails[currencyType.toLowerCase()])
            })
        );

        return await interaction.editReply({ files: [leaderboard] });
    }
}