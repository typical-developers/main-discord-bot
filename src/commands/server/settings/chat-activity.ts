import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';
import { type ApplicationCommandSubCommandData, type ApplicationCommandSubGroupData, ApplicationCommandOptionType, ApplicationIntegrationType, InteractionContextType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import RequestError from '#/lib/extensions/RequestError';
import APIRequestError from '#/lib/extensions/APIRequestError';
import { APIErrorCodes } from '#/lib/types/api';

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
        if (!interaction.guild) return;

        await interaction.deferReply({ withResponse: true, flags: [ MessageFlags.Ephemeral ] });
        const settings = await this.container.api.guilds.fetch(interaction.guild.id, { createNew: true });

        if (settings.isErr()) {
            this.container.logger.error(settings.error);

            return await interaction.editReply({
                content: 'Something went wrong fetching the guild\'s settings. Please try again later.',
            });
        };
        
        const { chatActivity } = settings.value;
        const isSuccess = await chatActivity.updateSettings({
            is_enabled: interaction.options.getBoolean('toggle') ?? undefined,
            grant_amount: interaction.options.getNumber('amount') ?? undefined,
            cooldown: interaction.options.getNumber('cooldown') ?? undefined
        });
    
        if (isSuccess.isErr()) {
            this.container.logger.error(isSuccess.error);

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
        if (!interaction.guild) return;

        await interaction.deferReply({ withResponse: true, flags: [ MessageFlags.Ephemeral ] });
        const settings = await this.container.api.guilds.fetch(interaction.guild.id, { createNew: true });
        if (settings.isErr()) {
            this.container.logger.error(settings.error);

            return await interaction.editReply({
                content: 'Something went wrong fetching the guild\'s settings. Please try again later.',
            });
        }

        const { chatActivity } = settings.value;
        const role = interaction.options.getRole('role', true);
        const requredPoints = interaction.options.getNumber('required-points', true);

        const isSuccess = await chatActivity.createActivityRole({ role_id: role.id, required_points: requredPoints });
        if (isSuccess.isErr()) {
            if (APIRequestError.isAPIError(isSuccess.error) && isSuccess.error.isErrorCode(APIErrorCodes.ActivityRoleExists)) {
                return await interaction.editReply({
                    content: 'The activity role already exists.',
                });
            }

            this.container.logger.error(isSuccess.error);
            return await interaction.editReply({
                content: 'There was an error creating the activity role.',
            });
        }

        await interaction.editReply({
            content: 'The activity role has been created.',
        });
    }
}