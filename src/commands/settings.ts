import type { GuildSettingsInput, RoleAddInput } from '@typical-developers/api-types/graphql';
import { ApplicationCommandOptionType, PermissionFlagsBits, type ApplicationCommandSubCommandData } from 'discord.js';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';
import { UserError } from '@sapphire/framework';

@ApplyOptions<Subcommand.Options>({
    description: 'Manage settings for the current guild.',
    subcommands: [
        { name: 'activity-defaults', chatInputRun: 'updateActivityDefaults' },
        { name: 'activity-role-add', chatInputRun: 'addActivityRole' },
        { name: 'activity-role-remove', chatInputRun: 'removeActivityRole' },
    ]
})
export class Settings extends Subcommand {
    private readonly _options: ApplicationCommandSubCommandData[] = [
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'activity-defaults',
            description: 'Manage the activity settings for the guild.',
            options: [
                {
                    type: ApplicationCommandOptionType.Boolean,
                    name: 'toggle',
                    description: 'Toggle activity points granting on/off.'
                },
                {
                    type: ApplicationCommandOptionType.Number,
                    name: 'cooldown',
                    description: 'Set the duration between activity grants in seconds.'
                },
                {
                    type: ApplicationCommandOptionType.Number,
                    name: 'amount',
                    description: 'Set the total amount of points granted each grant.'
                }
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'activity-role-add',
            description: 'Add a new activity role.',
            options: [
                {
                    type: ApplicationCommandOptionType.Role,
                    name: 'role',
                    description: 'The activity role to add.',
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.Number,
                    name: 'required-points',
                    description: 'The amount of points required to obtain this role.',
                    required: true
                }
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'activity-role-remove',
            description: 'Remove an existing activity role.',
            options: [
                {
                    type: ApplicationCommandOptionType.Role,
                    name: 'role',
                    description: 'The activity role to remove.',
                    required: true
                }
            ]
        }
    ];

    /**
     * Remove null settings values from an object.
     * @param options The object of options/
     * @returns 
     */
    private removeNullSettingOptions(options: object) {
        const settings = Object.entries(options)
            .reduce((acc, [k, v]) => {
                if (v !== null) {
                    acc[k] = v;
                }

                return acc;
            }, {} as Partial<GuildSettingsInput>);

        if (!Object.keys(settings).length) {
            throw new UserError({
                identifier: 'NO_SETTINGS',
                message: 'Please provide some settings to update.'
            });
        }

        return settings;
    }

    public override async registerApplicationCommands(registry: Subcommand.Registry) {
        registry
            .registerChatInputCommand({
                name: this.name,
                description: this.description,
                options: this._options,
                defaultMemberPermissions: [PermissionFlagsBits.Administrator],
            });
    }

    public async updateActivityDefaults(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return;

        const options = this.removeNullSettingOptions({
            activity_tracking: interaction.options.getBoolean('toggle'),
            activity_tracking_cooldown: interaction.options.getNumber('set-cooldown'),
            activity_tracking_grant: interaction.options.getNumber('set-amount')
        });

        const settings = await this.container.api.updateGuildSettings(interaction.guildId!, options);

        if (!settings) {
            throw new Error('Unable to update guild activity settings.');
        }

        return interaction.reply({
            content: 'Successfully updated activity settings.',
            ephemeral: true
        });
    }

    /**
     * TODO:
     * The activity role endpoint *does* support bulk adding/removing, though, figuring out the flow is incredibly hard.
     * Good idea to revisit this when Discord does add more bot capabilities (based on stuff I've seen that's in-dev)!!!!
     */

    public async addActivityRole(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guildId) return;

        const role: RoleAddInput = {
            role_id: interaction.options.getRole('role', true).id,
            required_points: interaction.options.getNumber('required-points', true)
        }

        const response = await this.container.api.updateGuildActivityRoles(interaction.guildId, { add: [role] });
        if (!response) {
            throw new Error(`Failed to add role for ${interaction.guildId}.`);
        }

        return interaction.reply({
            content: 'Successfully added new activity role!',
            ephemeral: true
        });
    }

    public async removeActivityRole(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guildId) return;

        const roleId = interaction.options.getRole('role', true).id;

        const response = await this.container.api.updateGuildActivityRoles(interaction.guildId, { remove: [roleId] });
        if (!response) {
            throw new Error(`Failed to remove role for ${interaction.guildId}.`);
        }

        return interaction.reply({
            content: 'Successfully remove the activity role!',
            ephemeral: true
        });
    }
}