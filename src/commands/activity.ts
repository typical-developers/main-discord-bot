import { ApplicationCommandOptionType, AttachmentBuilder } from 'discord.js';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';
import nodeHtmlToImage from 'node-html-to-image';
import { Readable } from 'stream';

@ApplyOptions<Subcommand.Options>({
    description: 'Get information on the server\'s activity!',
    subcommands: [
        { name: 'points', chatInputRun: 'getActivityPoints' },
        { name: 'leaderboard', chatInputRun: 'getActivityLeaderboard' }
    ]
})
export class ActivityDetails extends Subcommand {
    public override async registerApplicationCommands(registry: Subcommand.Registry) {
        registry
            .registerChatInputCommand({
                name: this.name,
                description: this.description,
                options: [
                    {
                        type: ApplicationCommandOptionType.Subcommand,
                        name: 'points',
                        description: 'a'
                    }
                ]
            });
    }

    /** Gets activity points for a member and returns a card displaing the information. */
    public async getActivityPoints(interaction: Subcommand.ChatInputCommandInteraction) {
        await interaction.deferReply({ fetchReply: true });

        try {
            const image = nodeHtmlToImage({
                html: '<html><body>Hello world!</body></html>',
                puppeteerArgs: {
                    executablePath: 'google-chrome-stable'
                }
            }).then((o) => Readable.from(o));
    
            const attachment = new AttachmentBuilder(await image, { name: 'test.png' });
    
            return interaction.editReply({
                files: [attachment]
            });
        } catch (e) {
            console.log(e);
        }
    }

    /** Gets the guild's leaderboard and returns a paginated message for getting more leaderboard details. */
    public async getActivityLeaderboard(interaction: Subcommand.ChatInputCommandInteraction) {

    }
}