import { Readable } from 'stream';
import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { type ApplicationCommandOptionData, GuildMember, ApplicationCommandOptionType, ApplicationCommandType, AttachmentBuilder, MessageFlags, InteractionContextType, ApplicationIntegrationType } from 'discord.js';
import { ImageProcessorErrorReference } from '#/lib/extensions/ImageProcessorError';

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
                dmPermission: false,
                contexts: [ InteractionContextType.Guild ],
                integrationTypes: [ ApplicationIntegrationType.GuildInstall ],
            })
            .registerContextMenuCommand({
                type: ApplicationCommandType.User,
                name: "Get User's Profile",
                dmPermission: false,
                contexts: [ InteractionContextType.Guild ],
                integrationTypes: [ ApplicationIntegrationType.GuildInstall ],
            });
    }

    private async generateCard(interaction: Command.ContextMenuCommandInteraction | Command.ChatInputCommandInteraction, userId: string) {
        /**
         * This is here to create guild settings incase they don't exist.
         */
        const settings = await this.container.api.getGuildSettings(interaction.guildId!, { create: true });
        if (settings.isErr()) {
            // todo: error handling & logging
            return;
        }

        if (!settings.value.chat_activity.is_enabled) {
            await interaction.reply({
                content: 'No tracking is enabled for this server.',
                flags: [ MessageFlags.Ephemeral ],
            });

            return;
        }

        await interaction.deferReply({ withResponse: true });

        const card = await this.container.api.getMemberProfileCard(interaction.guildId!, userId);
        if (card.isErr()) {
            const err = card.error

            if (err.reference === ImageProcessorErrorReference.StatusNotOK) {
                await interaction.editReply({
                    content: 'Member profile does not exist.',
                });
            }

            return;
        }

        const attachment = new AttachmentBuilder(Readable.from(card.value), { name: `${interaction.guildId!}-${userId}_profile.png` });
        return await interaction.editReply({
            files: [attachment]
        });
    }

    public override async contextMenuRun(interaction: Command.ContextMenuCommandInteraction) {
        const member = await interaction.guild?.members.fetch(interaction.targetId).catch(() => undefined);

        if (!member) {
            return await interaction.reply({
                content: 'Unable to fetch the member\'s details.',
                flags: [ MessageFlags.Ephemeral ]
            });
        }

        return this.generateCard(interaction, member.id);
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        let member: GuildMember | undefined;

        const user = interaction.options.getUser('user');
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
                flags: [ MessageFlags.Ephemeral ]
            });
        }

        return this.generateCard(interaction, member.id);
    }
}
