import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';
import { type ApplicationCommandSubCommandData, ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js';

@ApplyOptions<Subcommand.Options>({
    description: 'Manage server settings.',
    subcommands: [
        { name: 'chat-activity', type: 'method', chatInputRun: 'updateChatActivitySettings' },
        { name: 'add-activity-role', type: 'method', chatInputRun: 'addActivityRole' },
    ]
})
export class ServerSettings extends Subcommand {
    private readonly _options: ApplicationCommandSubCommandData[] = [
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'chat-activity',
            description: 'Manage the chat activity defaults.',
            options: [
                {
                    type: ApplicationCommandOptionType.Boolean,
                    name: 'toggle',
                    description: 'Toggle chat activity points granting on/off.'
                },
                {
                    type: ApplicationCommandOptionType.Number,
                    name: 'cooldown',
                    description: 'Set the duration between chat activity grants in seconds.'
                },
                {
                    type: ApplicationCommandOptionType.Number,
                    name: 'amount',
                    description: 'Set the total amount of chat points granted.'
                }
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'add-activity-role',
            description: 'Add a role to the list of roles that grant chat activity points.',
            options: [
                {
                    type: ApplicationCommandOptionType.String,
                    name: 'grant-type',
                    description: 'The type of chat activity to grant points for.',
                    required: true,
                    choices: [
                        { name: 'Chat', value: 'chat' },
                    ],
                },
                {
                    type: ApplicationCommandOptionType.Role,
                    name: 'role',
                    description: 'The role to add to the list of roles that grant chat activity points.',
                    required: true,
                },
                {
                    type: ApplicationCommandOptionType.Number,
                    name: 'required-points',
                    description: 'The amount of chat points required to grant the role.',
                    required: true,
                }
            ]
        }
    ];

    public override async registerApplicationCommands(registry: Subcommand.Registry) {
        registry.registerChatInputCommand({
            name: this.name,
            description: this.description,
            options: this._options,
            defaultMemberPermissions: [
                PermissionFlagsBits.ManageGuild
            ],
            dmPermission: false
        });
    }

    public async updateChatActivitySettings(interaction: Subcommand.ChatInputCommandInteraction) {
        await interaction.deferReply({ withResponse: true, flags: [ 'Ephemeral' ] })

        const toggle = interaction.options.getBoolean('toggle');
        const cooldown = interaction.options.getNumber('cooldown');
        const amount = interaction.options.getNumber('amount');

        const settings = await this.container.api.updateGuildActivitySettings(interaction.guildId!, {
            chat_activity: {
                enabled: toggle,
                cooldown: cooldown,
                grant_amount: amount
            }
        });

        if (settings.isErr()) {
            return interaction.editReply({
                content: settings.error.message,
            });
        }

        return interaction.editReply({
            content: 'Successfully updated chat activity settings.',
        });
    }

    public async addActivityRole(interaction: Subcommand.ChatInputCommandInteraction) {
        await interaction.deferReply({ withResponse: true, flags: [ 'Ephemeral' ] })

        const type = interaction.options.getString('grant-type', true);
        const role = interaction.options.getRole('role', true);
        const requiredPoints = interaction.options.getNumber('required-points', true);

        const settings = await this.container.api.insertGuildActivityRole(interaction.guildId!, {
            grant_type: type,
            role_id: role.id,
            required_points: requiredPoints
        });

        if (settings.isErr()) {
            return interaction.editReply({
                content: settings.error.message,
            });
        }

        return interaction.editReply({
            content: 'Successfully added role to activity role list.',
        });
    }
}