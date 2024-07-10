import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<Command.Options>({
    description: 'Fetch information on the SMP server!'
})
export class ServerProfile extends Command {
    public override async registerApplicationCommands(registry: Command.Registry) {
        registry
            .registerChatInputCommand({
                name: this.name,
                description: this.description,
            });
    }

    private async pingServer() {
        const url = new URL('/3/mc.typicaldevelopers.com', 'https://api.mcsrvstat.us');

        const response = await fetch(url).catch(() => null);
        if (!response || !response.ok) {
            return null;
        }

        const { players } = await response.json() as {
            // There are more types, but this is realistically all we need for now.
            players: { online: number; max: number; };
            [key: string]: any;
        }

        return { players };
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        await interaction.deferReply({ fetchReply: true });

        const serverInfo = await this.pingServer();
        if (!serverInfo) {
            return await interaction.reply({
                content: 'Unable to fetch status for the SMP.'
            });
        }

        const { players } = serverInfo;
        await interaction.editReply({
            content: `${players.online}/${players.max} currently online`
        });
    }
}
