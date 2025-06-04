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
import { fetchStore, topMaterialsToday, topUsersMonthly } from '#/lib/util/public-api';

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
                            // { name: 'Snowflakes', value: 'Snowflakes2024' }
                        ],
                        required: true
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
                            // { name: 'Snowflakes', value: 'Snowflakes2024' }
                        ],
                        required: true
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
    }

    public async dailyMaterialsLeaderboard(interaction: Subcommand.ChatInputCommandInteraction) {
    }

    public async monthlySellersLeaderboard(interaction: Subcommand.ChatInputCommandInteraction) {
    }
}