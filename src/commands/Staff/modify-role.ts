import { Command, type ChatInputCommand } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { type ApplicationCommandOptionData, ApplicationCommandOptionType, AutocompleteInteraction, PermissionFlagsBits } from 'discord.js';
import { getGuildSettings } from '#lib/util/database';

@ApplyOptions<ChatInputCommand.Options>({
	description: 'Modify a specific role for a member (add/remove).'
})
export class ModifyRoleCommand extends Command {
	readonly commandOptions: ApplicationCommandOptionData[] = [
		{
			type: ApplicationCommandOptionType.User,
			name: 'member',
			description: "The member you'd like to update the role for.",
			required: true
		},
		{
			type: ApplicationCommandOptionType.String,
			name: 'role',
			description: "The role for the member that you'd like to update.",
			autocomplete: true,
			required: true
		}
	];

	public override registerApplicationCommands(registry: ChatInputCommand.Registry) {
		registry.registerChatInputCommand({
			name: this.name,
			description: this.description,
			options: this.commandOptions,
			defaultMemberPermissions: PermissionFlagsBits.ManageRoles,
			dmPermission: false
		});
	}

	public override async autocompleteRun(interaction: AutocompleteInteraction) {
		if (!interaction.guildId) return;

		const GUILDSETTINGS = await getGuildSettings(interaction.guildId);
		if (!GUILDSETTINGS?.grantable_roles) return;

		const CHOICES = [];
		for (let roleId of GUILDSETTINGS.grantable_roles) {
			const ROLE = await interaction.guild?.roles.fetch(roleId);
			if (!ROLE) return;

			CHOICES.push({
				name: ROLE.name,
				value: roleId
			});
		}

		await interaction.respond(CHOICES);
	}

	public override async chatInputRun(interaction: ChatInputCommand.Interaction) {
		if (!interaction.guild) return;

		const USER = interaction.options.getUser('member', true);
		const ROLEID = interaction.options.getString('role', true);

		const GUILDSETTINGS = await getGuildSettings(interaction.guild.id);
		if (!GUILDSETTINGS?.grantable_roles.includes(ROLEID)) return;

		const MEMBER = await interaction.guild?.members.fetch(USER.id);
		const ROLE = await interaction.guild?.roles.fetch(ROLEID).catch(() => null);

		if (!ROLE) {
			return interaction.reply({
				ephemeral: true,
				content: 'There was an issue fetching the role to modify.'
			});
		}

		if (ROLE.members.has(USER.id)) {
			MEMBER?.roles
				.remove(ROLEID)
				.then(() => {
					interaction.reply({
						ephemeral: true,
						content: `Successfully removed role <@&${ROLEID}> for member <@${USER.id}>.`
					});
				})
				.catch(() => {
					interaction.reply({
						ephemeral: true,
						content: `Unable to remove role <@&${ROLEID}> for member <@${USER.id}>. The bot is likely missing MANAGE_ROLE permissions or is below the role in hierarchy.`
					});
				});
		} else {
			MEMBER?.roles
				.add(ROLEID)
				.then(() => {
					interaction.reply({
						ephemeral: true,
						content: `Successfully added role <@&${ROLEID}> for member <@${USER.id}>.`
					});
				})
				.catch(() => {
					interaction.reply({
						ephemeral: true,
						content: `Unable to add role <@&${ROLEID}> for member <@${USER.id}>. The bot is likely missing MANAGE_ROLE permissions or is below the role in hierarchy.`
					});
				});
		}

		return;
	}
}
