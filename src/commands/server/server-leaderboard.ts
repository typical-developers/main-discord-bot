import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';
import { type ApplicationCommandSubCommandData } from 'discord.js';

@ApplyOptions<Subcommand.Options>({
    description: 'Leaderboards relating to server statistics.',
})
export class ServerLeaderboard extends Subcommand {
    private readonly _groupOptions: ApplicationCommandSubCommandData[] = [
    ];

    public override async registerApplicationCommands(registry: Subcommand.Registry) {
        registry
            .registerChatInputCommand({
                name: process.env.DEV_DEPLOYMENT === 'true'
                    ? `stging-${this.name}`
                    : this.name,
                description: this.description,
                options: this._groupOptions,
                dmPermission: false
            });
    }
}