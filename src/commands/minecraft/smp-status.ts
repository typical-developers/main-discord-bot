import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { AttachmentBuilder, codeBlock, EmbedBuilder, inlineCode } from 'discord.js';

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

        const { online, players, icon, hostname } = await response.json() as {
            // There are more types, but this is realistically all we need for now.
            online: boolean;
            players: {
                online: number;
                max: number;
                list?: {
                    name: string;
                    uuid: string;
                }[];
            };
            icon: string;
            hostname: string;
        }

        return { online, players, icon, hostname };
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        await interaction.deferReply({ fetchReply: true });

        const serverInfo = await this.pingServer();
        if (!serverInfo) {
            return await interaction.reply({
                content: 'Unable to fetch status for the SMP.'
            });
        }

        const { online, players, icon, hostname } = serverInfo;
        const iconAttachment = new AttachmentBuilder(Buffer.from(icon.replace('data:image\/png;base64', ''), 'base64'), { name: 'icon.png' });
        const statusEmbed = new EmbedBuilder({
            color: 0xfede3a,
            title: 'Typical Developers SMP',
            description: `
                **Server Status:** ${inlineCode(online ? '🟢 Online' : '🔴 Offline')}
                **IP:** ${inlineCode(hostname)}
            `,
            fields: [
                {
                    name: `Players ${players.online}/${players.max}`,
                    value: codeBlock(players.list?.length
                        ? players.list.map(({ name }) => name).join(', \n')
                        : 'No players currently online.'
                    )
                }
            ],
            thumbnail: { url: `attachment://icon.png` },
            timestamp: Date.now()
        });

        await interaction.editReply({
            embeds: [statusEmbed],
            files: [iconAttachment]
        });
    }
}
