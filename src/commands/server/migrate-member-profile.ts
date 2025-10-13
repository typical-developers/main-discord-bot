import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { type ApplicationCommandOptionData, ApplicationCommandOptionType, InteractionContextType, ApplicationIntegrationType, PermissionFlagsBits, MessageFlags, GuildMember } from 'discord.js';

@ApplyOptions<Command.Options>({
    description: 'Get information on a server member!'
})
export class MigrateMemberProfile extends Command {
    readonly _options: ApplicationCommandOptionData[] = [
        {
            type: ApplicationCommandOptionType.User,
            name: 'from-user',
            description: "The member you'd like to migrate from.",
        },
        {
            type: ApplicationCommandOptionType.User,
            name: 'to-user',
            description: "The member you'd like to migrate from.",
        },
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
                defaultMemberPermissions: [ PermissionFlagsBits.Administrator ],
            })
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        if (!interaction.guild) return;

        const fromUser = interaction.options.getUser('from-user', true);
        const toUser = interaction.options.getUser('to-user', true);

        /**
         * The member having their profile migrated to *should* be in the guild.
         * It doesn't make sense to migrate to a user that isn't in the guild.
         */
        const isInGuild = await interaction.guild.members.fetch(toUser.id).catch(() => undefined);
        if (!isInGuild) {
            return await interaction.reply({
                content: 'The user attempting to migrate to is not in the guild.',
                flags: [ MessageFlags.Ephemeral ],
            });
        }

        await interaction.deferReply({ withResponse: true, flags: [ MessageFlags.Ephemeral ] });

        const response = await this.container.api.members.migrateMemberProfile(interaction.guild.id, fromUser.id, { to_member_id: toUser.id });
        if (response.isErr()) {
            this.container.logger.error(response.error);
            return await interaction.editReply({
                content: 'There was an error migrating the member profile.',
            });
        }

        return await interaction.editReply({
            content: `Successfully migrated the member profile: <@${fromUser.id}> (${fromUser.id}) -> <@${toUser.id}> (${fromUser.id}).`,
        });
    }
}
