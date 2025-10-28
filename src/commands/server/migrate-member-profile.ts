import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { type ApplicationCommandOptionData, ApplicationCommandOptionType, InteractionContextType, ApplicationIntegrationType, PermissionFlagsBits, MessageFlags, GuildMember } from 'discord.js';

@ApplyOptions<Command.Options>({
    description: 'Migrate the profile of a server member to another member.'
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

        if (interaction.user.id !== '399416615742996480') {
            return await interaction.reply({
                content: 'Only <@399416615742996480> can run this command at this time.',
                flags: [ MessageFlags.Ephemeral ],
            });
        }

        const fromUser = interaction.options.getUser('from-user', true);
        const toUser = interaction.options.getUser('to-user', true);

        /**
         * The member having their profile migrated to *should* be in the guild.
         * It doesn't make sense to migrate to a user that isn't in the guild.
         */
        const toGuildMember = await interaction.guild.members.fetch(toUser.id).catch(() => undefined);
        if (!toGuildMember) {
            return await interaction.reply({
                content: 'The user attempting to migrate to is not in the guild.',
                flags: [ MessageFlags.Ephemeral ],
            });
        }

        await interaction.deferReply({ withResponse: true, flags: [ MessageFlags.Ephemeral ] });

        const settings = await this.container.api.guilds.fetch(interaction.guild.id);
        if (settings.isErr())
            return await interaction.editReply({
                content: 'Something went wrong fetching the guild\'s settings. Please try again later.',
            });

        const isSuccess = await settings.value.members.migrateProfile(fromUser.id, toUser.id);
        if (isSuccess.isErr()) {
            this.container.logger.error(isSuccess.error);
            return await interaction.editReply({
                content: 'There was an error migrating the member profile.',
            });
        }

        /**
         * Attempt to remove the activity roles that were granted to the old user.
         * It's not a big issue if they fail to remove.
         */
        let removedOldRoles = true; // assumes they either have none to remove or the attempt succeeded
        const fromGuildMember = await interaction.guild.members.fetch(fromUser.id).catch(() => undefined);
        if (fromGuildMember && !settings.isErr()) {
            const activityRoles = settings.value.chatActivity.activityRoles.map((a) => a.roleId);
            const removeRoles = activityRoles.filter((id) => fromGuildMember.roles.cache.has(id));
            
            if (removeRoles.length)
                await fromGuildMember.roles.remove(removeRoles, 'Automated Action - Member profile was migrated to another user.')
                    .catch(() => removedOldRoles = false);
        }

        return await interaction.editReply({
            content: `Successfully migrated the member profile: <@${fromUser.id}> (${fromUser.id}) -> <@${toUser.id}> (${toUser.id}). ${!removedOldRoles ? 'Old roles could not be removed from the user. Please manually remove them.' : ''}`,
        });
    }
}
