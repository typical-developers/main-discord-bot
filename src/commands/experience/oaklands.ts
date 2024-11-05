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
import { fetchStore, topMaterialsToday, topUsersMonthly } from '@/lib/util/public-api';

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
                    description: 'Fetch the current top daily materials.'
                },
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: 'monthly-sellers',
                    description: 'Fetch the current top monthly sellers.'
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

    private readonly _shopItemsThumbnails: Record<string, string> = {
        WitchesBrew: "https://tr.rbxcdn.com/180DAY-0c8652841b77bbee2ffee7e63ed51794/150/150/Gear/Webp/noFilter",
        Oakpiece: "",
        VinylStud: "https://static.miraheze.org/oaklandsrblxwikiwiki/0/04/Vinyl-Stud_Vinyl.png",
        ClassicJeepVehiclePad: "https://static.miraheze.org/oaklandsrblxwikiwiki/5/55/Classic_Joop.png",
        BloxyCola: "https://tr.rbxcdn.com/180DAY-90b877c5aecda54566b428250712c21b/150/150/Gear/Webp/noFilter",
        TobascoSauce: "https://tr.rbxcdn.com/180DAY-a2ecaf223b1aed9ad0bcca15dda049be/150/150/Gear/Webp/noFilter",
        RocketLauncher: "https://static.miraheze.org/oaklandsrblxwikiwiki/f/f5/Confetti_Launcher.png",
        TeamFlag: "https://static.miraheze.org/oaklandsrblxwikiwiki/6/6a/Team_Flag_Red.png",
        StudGift: "",
        Slingshot:"",
        Trowel: "",
        HealingCoil: "https://tr.rbxcdn.com/180DAY-d147d1c62a17bccd46ab2fed0f7c5a61/150/150/Gear/Webp/noFilter",
        // GiftOfEmotion: "",
        ClassicBillboard: "",
        BabyDucky: "https://tr.rbxcdn.com/180DAY-8ec8b7ea7250d6f47a87b1f69123bbcd/150/150/Hat/Webp/noFilter",
        CannedBeans: "https://tr.rbxcdn.com/180DAY-2a535f607032decea59ba0552830542e/150/150/Gear/Webp/noFilter",
        GravityCoil: "https://tr.rbxcdn.com/180DAY-5a087350499e826bfd11e06a312b8f45/150/150/Gear/Webp/noFilter",
        SpeedCoil: "https://tr.rbxcdn.com/180DAY-7ee382f34b7657e33a2f94ad863f1b14/150/150/Gear/Webp/noFilter",
        TrappedBeans: "https://tr.rbxcdn.com/180DAY-2a535f607032decea59ba0552830542e/150/150/Gear/Webp/noFilter",
        SubspaceTripmine: "https://tr.rbxcdn.com/180DAY-8aa4c9d1585a59ca78ce7657f6728c7b/150/150/Gear/Webp/noFilter",
        LinkedSword: "https://tr.rbxcdn.com/180DAY-4abe6932f60781b03a2c15e399a4be92/150/150/Gear/Webp/noFilter" ,
        ClassicMoai: "https://tr.rbxcdn.com/180DAY-0ed7be414329998ea0b4cc25b4e391d1/150/150/Hat/Webp/noFilter"
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
                    .filter((item) => this._shopItemsThumbnails[item.identifier] !== undefined)
                    .map((item) => ({
                        thumbnail: this._shopItemsThumbnails[item.identifier],
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
        candy2024: { type: '🍬', color: '#D82A40' }
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
                resetTime: getResetTime(new Date(playersLeaderboard.reset_time)),
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