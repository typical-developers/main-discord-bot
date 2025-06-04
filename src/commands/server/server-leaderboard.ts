import { ApplicationCommandOptionType, AttachmentBuilder, type ApplicationCommandSubCommandData } from 'discord.js';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';
import { UserError } from '@sapphire/framework';

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
    }

    private leaderboardHeaders(type: string) {
    }

    public async getGuildActivityLeaderboard(interaction: Subcommand.ChatInputCommandInteraction) {
    }
}