import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';
import { type ApplicationCommandSubCommandData, type ApplicationCommandSubGroupData, ApplicationCommandOptionType, ApplicationIntegrationType, InteractionContextType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import RequestError from '#/lib/extensions/RequestError';

@ApplyOptions<Subcommand.Options>({
    description: 'Manage chat activity settings.',
    subcommands: [
        { name: 'settings', type: 'method', chatInputRun: 'updateChatActivitySettings' },
        {
            name: 'role', type: 'group',
            entries: [
                { name: 'add', type: 'method', chatInputRun: 'addActivityRole' },
            ]
        },
    ],
    requiredUserPermissions: [ PermissionFlagsBits.Administrator ]
})
export class ChatActivitySettings extends Subcommand {
    private readonly _options: (ApplicationCommandSubCommandData | ApplicationCommandSubGroupData)[] = [
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'settings',
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
            type: ApplicationCommandOptionType.SubcommandGroup,
            name: 'role',
            description: 'Add a role to the list of roles that grant chat activity points.',
            options: [
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: 'add',
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
            ]
        },
    ];

    public override async registerApplicationCommands(registry: Subcommand.Registry) {
        registry.registerChatInputCommand({
            name: this.name,
            description: this.description,
            options: this._options,
            defaultMemberPermissions: [ PermissionFlagsBits.Administrator ],
            dmPermission: false,
            contexts: [ InteractionContextType.Guild ],
            integrationTypes: [ ApplicationIntegrationType.GuildInstall ],
        });
    }

    public async updateChatActivitySettings(interaction: Subcommand.ChatInputCommandInteraction) {
        if (interaction.guild == null) return;

        await interaction.deferReply({ withResponse: true, flags: [ MessageFlags.Ephemeral ] });
        const settings = await this.container.api.guilds.getGuildSettings(interaction.guild.id, { create: true });
        if (settings.isErr()) {
            this.container.logger.error(settings.error);

            await interaction.editReply({
                content: 'Something went wrong fetching the guild\'s settings. Please try again later.',
            });

            return;
        }

        const toggle = interaction.options.getBoolean('toggle') ?? undefined;
        const cooldown = interaction.options.getNumber('cooldown') ?? undefined;
        const amount = interaction.options.getNumber('amount') ?? undefined;
        const data = await this.container.api.guilds.updateGuildActivitySettings(interaction.guild.id, {
            chat_activity: {
                is_enabled: toggle,
                grant_amount: amount,
                cooldown: cooldown
            }
        });

        if (data.isErr()) {
            this.container.logger.error(data.error);

            await interaction.editReply({
                content: 'There was an error updating the chat activity settings.',
            });

            return;
        }

        await interaction.editReply({
            content: 'The chat activity settings have been updated.',
        });
    }

    public async addActivityRole(interaction: Subcommand.ChatInputCommandInteraction) {
        if (interaction.guild == null) return;

        await interaction.deferReply({ withResponse: true, flags: [ MessageFlags.Ephemeral ] });
        const settings = await this.container.api.guilds.getGuildSettings(interaction.guild.id, { create: true });
        if (settings.isErr()) {
            this.container.logger.error(settings.error);

            await interaction.editReply({
                content: 'Something went wrong fetching the guild\'s settings. Please try again later.',
            });

            return;
        }

        const grantType = interaction.options.getString('grant-type', true);
        const role = interaction.options.getRole('role', true);
        const requiredPoints = interaction.options.getNumber('required-points', true);
        const data = await this.container.api.guilds.createAcitivtyRole(interaction.guild.id, {
            activity_type: grantType,
            role_id: role.id,
            required_points: requiredPoints
        });

        if (data.isErr()) {
            if (data.error instanceof RequestError && data.error.response.status !== 409) {
                this.container.logger.error(data.error);

                await interaction.editReply({
                    content: 'There was an error creating the activity role.',
                });

                return;
            }
            
            await interaction.editReply({
                content: 'The activity role already exists.',
            });

            return;
        }

        await interaction.editReply({
            content: 'The activity role has been created.',
        });
    }
}