import { ApplyOptions } from '@sapphire/decorators';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplicationCommandOptionType, PermissionFlagsBits, type ApplicationCommandOptionData } from 'discord.js';
import { getGuildSettings, updateGuildSettings } from '#lib/util/database';

@ApplyOptions<Subcommand.Options>({
	description: "Update your guild's settings.",
	subcommands: [
		{ name: 'custom-voice', chatInputRun: 'setVoiceChannelSettings' },
		{ name: 'grantable-roles', chatInputRun: 'setGrantableRoles' }
	]
})
export class GuildSettingsCommand extends Subcommand {
	readonly commandOptions: ApplicationCommandOptionData[] = [
		{
			type: ApplicationCommandOptionType.Subcommand,
			name: 'grantable-roles',
			description: 'Update what roles are grantable by staff.',
			options: [
				{
					type: ApplicationCommandOptionType.Role,
					name: 'add',
					description: 'The roles that you want to be grantable.'
				},
				{
					type: ApplicationCommandOptionType.String,
					name: 'remove',
					description: 'The roles that you no longer want to be grantable.',
					autocomplete: true
				}
			]
		}
	];

	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand({
			name: this.name,
			description: this.description,
			options: this.commandOptions,
			defaultMemberPermissions: PermissionFlagsBits.ManageGuild
		});
	}

	public override async autocompleteRun(interaction: Subcommand.AutocompleteInteraction) {
		if (!interaction.guildId) return;

		// const FOCUSED = interaction.options.getFocused(true);
		const GUILDSETTINGS = await getGuildSettings(interaction.guildId);
		if (!GUILDSETTINGS) return;

		switch (interaction.options.getSubcommand()) {
			case 'activity-points':
				break;
			case 'custom-voice':
				break;
			case 'grantable-roles':
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
				break;
			default:
				break;
		}
	}

	// public async setVoiceChannelSettings() {

	// }

	// public async setActvityRoleSettings() {

	// }

	public async setGrantableRoles(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.guildId) return;

		const ADD = interaction.options.getRole('add');
		const REMOVE = interaction.options.getString('remove');
		if (!ADD && !REMOVE) return;

		const GUILDSETTINGS = await getGuildSettings(interaction.guildId);
		if (!GUILDSETTINGS) return;

		let addExists = false;
		let removeExists = false;
		for (let roleId of GUILDSETTINGS.grantable_roles) {
			if (addExists && !REMOVE) break;
			if (removeExists && !ADD) break;
			if (addExists && removeExists) break;

			if (!addExists && roleId === ADD?.id) {
				addExists = true;
				continue;
			}

			if (!removeExists && roleId === REMOVE) {
				removeExists = true;
				continue;
			}
		}

		if (addExists && !removeExists) {
			interaction.reply({
				ephemeral: true,
				content: 'There are no roles to add or remove.'
			});

			return;
		}

		const GRANTABLE = [...GUILDSETTINGS.grantable_roles];

		if (!addExists && ADD) {
			GRANTABLE.push(ADD?.id);
		}

		if (removeExists && REMOVE) {
			const INDEX = GRANTABLE.indexOf(REMOVE);

			if (INDEX > -1) {
				GRANTABLE.splice(INDEX, 1);
			}
		}

		const NEWSETTINS = await updateGuildSettings(interaction.guildId, Object.assign(GUILDSETTINGS, { grantable_roles: GRANTABLE }));
		if (!NEWSETTINS) {
			interaction.reply({
				ephemeral: true,
				content: "There was an issue updating the guild's settings."
			});

			return;
		}

		interaction.reply({
			ephemeral: true,
			content: 'Successfully updated grantable roles.'
		});

		return;
	}
}
