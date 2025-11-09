import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { type ApplicationCommandOptionData, GuildMember, ApplicationCommandOptionType, ApplicationCommandType, AttachmentBuilder, MessageFlags, InteractionContextType, ApplicationIntegrationType, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import RequestError from '#/lib/extensions/RequestError';
import { profileCard } from '#/lib/util/buttons';
import APIRequestError from '#/lib/extensions/APIRequestError';
import { APIErrorCodes } from '#/lib/types/api';

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
        if (!interaction.guild) return;

        await interaction.deferReply({ withResponse: true });

        const settings = await this.container.api.guilds.fetch(interaction.guild.id, { createNew: true });
        if (settings.isErr()) {
            this.container.logger.error(settings.error);
            return await interaction.editReply({
                content: 'Something went wrong while generating the leaderboard card.'
            });
        }

        const { chatActivity: chatActivitySettings } = settings.value;
        if (!chatActivitySettings.isEnabled)
            return await interaction.editReply({
                content: 'Chat activity tracking is not enabled for this guild.'
            });

        const member = await settings.value.members.fetch(userId);
        if (member.isErr()) {
            if (APIRequestError.isAPIError(member.error) && member.error.isErrorCode(APIErrorCodes.MemberProfileNotFound)) {
                return await interaction.editReply({
                    content: 'The requested member does not exist.',
                });
            }

            this.container.logger.error(member.error);
            return await interaction.editReply({
                content: 'Something went wrong while generating the leaderboard card.'
            });
        }

        const image = await member.value.generateProfileCard();
        if (image.isErr()) {
            if (image.error.hasResponse() && image.error.response.status === 429) {
                return await interaction.editReply({
                    content: 'Too many cards are being generated right now, try again in a bit.',
                });
            }

            this.container.logger.error(image.error);
            return await interaction.editReply({
                content: 'There was an issue generating the profile card. This has been forwarded to the developers.',
            });
        }

        const isOriginalUser = interaction.user.id === userId; /** Only allow refreshing if the user that ran the interaction is the same as the user that generated the card. */
        const attachment = new AttachmentBuilder(image.value, { name: 'profile-card.png' });
        return await interaction.editReply({
            files: [ attachment ],
            components: isOriginalUser ? [ profileCard() ] : []
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
        } else {
            if (!interaction.member)
                return;

            member = await interaction.guild?.members.fetch(interaction.member.user.id).catch(() => undefined);
        }

        if (!member)
            return await interaction.reply({
                content: 'Unable to fetch the member\'s details.',
                flags: [ MessageFlags.Ephemeral ]
            });

        return this.generateCard(interaction, member.id);
    }
}
