import { Readable } from 'stream';
import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { type ApplicationCommandOptionData, GuildMember, ApplicationCommandOptionType, ApplicationCommandType, AttachmentBuilder } from 'discord.js';

@ApplyOptions<Command.Options>({
    description: 'Get information on a server member!'
})
export class ServerProfile extends Command {
    readonly _options: ApplicationCommandOptionData[] = [
        {
            type: ApplicationCommandOptionType.User,
            name: 'user',
            description: "The member you'd like fetch an activity card for.",
            required: false
        }
    ];

    public override async registerApplicationCommands(registry: Command.Registry) {
        registry
            .registerChatInputCommand({
                name: this.name,
                description: this.description,
                options: this._options,
                dmPermission: false
            })
            .registerContextMenuCommand({
                type: ApplicationCommandType.User,
                name: "Get User's Profile",
                dmPermission: false
            });
    }

    private async generateCard(interaction: Command.ContextMenuCommandInteraction | Command.ChatInputCommandInteraction, member: GuildMember) {
        /**
         * This is here to create guild settings incase they don't exist.
         */
        const settings = await this.container.api.getGuildSettings(interaction.guildId!, { create: true });
        if (settings.isErr()) {
            // todo: error handling & logging
            return;
        }

        const card = await this.container.api.getMemberProfileCard(interaction.guildId!, member.id);
        if (card.isErr()) {
            // todo: error handling & logging
            return;
        }

        const img = await this.container.imageProcessor.draw({ html: card.value, transparency: true });
        const attachment = new AttachmentBuilder(Readable.from(img), { name: 'profile.png' });

        return await interaction.reply({
            files: [attachment]
        });
    }

    public override async contextMenuRun(interaction: Command.ContextMenuCommandInteraction) {
        const member = await interaction.guild?.members.fetch(interaction.targetId).catch(() => undefined);

        if (!member) {
            return await interaction.reply({
                content: 'Unable to fetch the member\'s details.',
                ephemeral: true
            });
        }

        return this.generateCard(interaction, member);
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        let member: GuildMember | undefined;

        const user = interaction.options.getUser('user');

        /**
         * This is a lot more hacky than it should be.
         * Should look into how to make this better, but based on types, data returned can be different.
         */
        if (user) {
            member = await interaction.guild?.members.fetch(user.id).catch(() => undefined);
        }
        else {
            if (!interaction.member) return;
            member = await interaction.guild?.members.fetch(interaction.member.user.id).catch(() => undefined);
        }

        if (!member) {
            return await interaction.reply({
                content: 'Unable to fetch the member\'s details.',
                ephemeral: true
            });
        }

        return this.generateCard(interaction, member);
    }
}
