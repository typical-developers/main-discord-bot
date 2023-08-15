import { ApplyOptions } from '@sapphire/decorators';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplicationCommandOptionType, PermissionFlagsBits, type ApplicationCommandOptionData } from 'discord.js';
import { getGuildSettings, updateGuildSettings } from '#lib/util/database';

@ApplyOptions<Subcommand.Options>({
	description: "Update your guild's settings.",
	subcommands: [
		// { name: 'custom-voice', chatInputRun: 'setVoiceChannelSettings' },
		{ name: 'grantable-roles', chatInputRun: 'setGrantableRoles' },
		{
			name: 'activity',
			type: 'group',
			entries: [
				{ name: 'system', chatInputRun: 'toggleActivitySystem' },
				{ name: 'add-role', chatInputRun: 'addActivityRole' },
				{ name: 'remove-role', chatInputRun: 'removeActivityRole' }
			]
		}
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
		},
		{
			type: ApplicationCommandOptionType.SubcommandGroup,
			name: 'activity',
			description: 'Update settings relating to the activity system.',
			options: [
				{
					type: ApplicationCommandOptionType.Subcommand,
					name: 'system',
					description: 'Enable / disable the system.'
				},
				{
					type: ApplicationCommandOptionType.Subcommand,
					name: 'add-role',
					description: 'Adds a new activity role.',
					options: [
						{
							type: ApplicationCommandOptionType.Role,
							name: 'role',
							description: 'The role that you want to be grantable.',
							required: true
						},
						{
							type: ApplicationCommandOptionType.Number,
							name: 'amount',
							description: 'The amount of points needed for the role.',
							required: true
						}
					]
				},
				{
					type: ApplicationCommandOptionType.Subcommand,
					name: 'remove-role',
					description: 'Removes an activity role.',
					options: [
						{
							type: ApplicationCommandOptionType.String,
							name: 'role',
							description: 'The amount of points needed for the role.',
							autocomplete: true,
							required: true
						}
					]
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

		const GUILDSETTINGS = await getGuildSettings(interaction.guildId);
		if (!GUILDSETTINGS) return;

		const CHOICES = [];
		switch (interaction.options.getSubcommand()) {
			case 'grantable-roles':
				for (let roleId of GUILDSETTINGS.grantable_roles) {
					const ROLE = await interaction.guild?.roles.fetch(roleId);
					if (!ROLE) continue;

					CHOICES.push({
						name: `@${ROLE.name}`,
						value: roleId
					});
				}

				break;
			case 'remove-role':
				for (let [points, roleId] of GUILDSETTINGS.activity_roles) {
					const ROLE = await interaction.guild?.roles.fetch(roleId);
					if (!ROLE) continue;

					CHOICES.push({
						name: `@${ROLE.name} (${points} points)`,
						value: roleId
					});
				}

				break;
			default:
				break;
		}

		await interaction.respond(CHOICES);
	}

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

		const NEWSETTINS = await updateGuildSettings(interaction.guildId, { grantable_roles: GRANTABLE });
		if (!NEWSETTINS) {
			return interaction.reply({
				ephemeral: true,
				content: "There was an issue updating the guild's settings."
			});
		}

		return interaction.reply({
			ephemeral: true,
			content: 'Successfully updated grantable roles.'
		});
	}

	public async toggleActivitySystem(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.guild) return;

		const SETTINGS = await getGuildSettings(interaction.guild.id);
		if (!SETTINGS) return;

		const NEWSETTINGS = await updateGuildSettings(interaction.guild.id, { points_system: !SETTINGS.points_system });
		if (!NEWSETTINGS) {
			return interaction.reply({
				ephemeral: true,
				content: "There was an issue updating the guild's settings."
			});
		}

		return interaction.reply({
			ephemeral: true,
			content: `
				Successfully ${!SETTINGS.points_system ? 'enabled' : 'disabled'} the points system.
			`
		});
	}

	public async addActivityRole(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.guild) return;

		const AMOUNT = interaction.options.getNumber('amount', true);
		const ROLE = interaction.options.getRole('role', true);

		const GUILDSETTINGS = await getGuildSettings(interaction.guild.id);
		if (!GUILDSETTINGS) return;

		if (GUILDSETTINGS.activity_roles.filter(([_, roleId]) => roleId === ROLE.id).length) {
			return interaction.reply({
				ephemeral: true,
				content: 'You already have this role listed as an activity role!'
			});
		}

		const NEWROLES = [...GUILDSETTINGS.activity_roles];
		NEWROLES.push([AMOUNT, ROLE.id]);
		NEWROLES.sort(([a], [b]) => {
			if (a >= b) {
				return 1;
			} else {
				return -1;
			}
		});

		const NEWSETTINGS = await updateGuildSettings(interaction.guild.id, { activity_roles: NEWROLES });
		if (!NEWSETTINGS) {
			return interaction.reply({
				ephemeral: true,
				content: "There was an issue updating the guild's settings."
			});
		}

		return interaction.reply({
			ephemeral: true,
			content: `Successfully added new activity role.`
		});
	}

	public async removeActivityRole(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.guild) return;

		const ROLEID = interaction.options.getString('role', true);
		if (!ROLEID) return;

		const GUILDSETTINGS = await getGuildSettings(interaction.guild.id);
		if (!GUILDSETTINGS) return;

		const NEWROLES = GUILDSETTINGS.activity_roles.filter(([_, roleId]) => ROLEID !== roleId);
		const NEWSETTINGS = await updateGuildSettings(interaction.guild.id, { activity_roles: NEWROLES });
		if (!NEWSETTINGS) {
			return interaction.reply({
				ephemeral: true,
				content: "There was an issue updating the guild's settings."
			});
		}

		return interaction.reply({
			ephemeral: true,
			content: `Successfully removed activity role.`
		});
	}
}
