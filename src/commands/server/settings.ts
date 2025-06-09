import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';
import { type ApplicationCommandSubCommandData, ApplicationCommandOptionType, ApplicationIntegrationType, InteractionContextType, MessageFlags, PermissionFlagsBits } from 'discord.js';

@ApplyOptions<Subcommand.Options>({
    description: 'Manage server settings.',
    subcommands: [
        { name: 'chat-activity', type: 'method', chatInputRun: 'updateChatActivitySettings' },
        { name: 'add-activity-role', type: 'method', chatInputRun: 'addActivityRole' },
        { name: 'add-voice-room-lobby', type: 'method', chatInputRun: 'addVoiceRoomLobby' },
        { name: 'update-voice-room-lobby', type: 'method', chatInputRun: 'updateVoiceRoomLobby' },
        { name: 'remove-voice-room-lobby', type: 'method', chatInputRun: 'removeVoiceRoomLobby' },
    ],
    requiredUserPermissions: [ PermissionFlagsBits.Administrator ]
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
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'add-voice-room-lobby',
            description: 'Create a new lobby for creating voice rooms.',
            options: [
                {
                    type: ApplicationCommandOptionType.String,
                    name: 'channel',
                    description: 'The channel that will be considered the lobby.',
                    required: true,
                    autocomplete: true,
                },
                {
                    type: ApplicationCommandOptionType.Number,
                    name: 'user-limit',
                    description: 'How many users can join the created voice room.',
                },
                {
                    type: ApplicationCommandOptionType.Boolean,
                    name: 'can-rename',
                    description: 'Whether or not the created voice room can be renamed.',
                },
                {
                    type: ApplicationCommandOptionType.Boolean,
                    name: 'can-lock',
                    description: 'Whether or not the created voice room can be locked.',
                },
                {
                    type: ApplicationCommandOptionType.Boolean,
                    name: 'can-adjust-limit',
                    description: 'Whether or not the created voice room can has its user limit adjusted.',
                },
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'update-voice-room-lobby',
            description: 'Update a lobby for creating voice rooms.',
            options: [
                {
                    type: ApplicationCommandOptionType.String,
                    name: 'channel',
                    description: 'The channel that will be considered the lobby.',
                    required: true,
                    autocomplete: true,
                },
                {
                    type: ApplicationCommandOptionType.Number,
                    name: 'user-limit',
                    description: 'How many users can join the created voice room.',
                },
                {
                    type: ApplicationCommandOptionType.Boolean,
                    name: 'can-rename',
                    description: 'Whether or not the created voice room can be renamed.',
                },
                {
                    type: ApplicationCommandOptionType.Boolean,
                    name: 'can-lock',
                    description: 'Whether or not the created voice room can be locked.',
                },
                {
                    type: ApplicationCommandOptionType.Boolean,
                    name: 'can-adjust-limit',
                    description: 'Whether or not the created voice room can has its user limit adjusted.',
                },
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'remove-voice-room-lobby',
            description: 'Remove a lobby for creating voice rooms.',
            options: [
                {
                    type: ApplicationCommandOptionType.String,
                    name: 'channel',
                    description: 'The channel that will be considered the lobby.',
                    required: true,
                    autocomplete: true,
                },
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
        await interaction.deferReply({ withResponse: true });

        /**
         * Makes sure that the guild settings are created and cached.
         */
        await this.container.api.getGuildSettings(interaction.guildId!, { create: true });

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
            this.container.logger.error(settings.error);

            await interaction.editReply({
                content: `Failed to update chat activity settings. This has been forwarded to the developers.`
            });

            return;
        }

        return interaction.editReply({
            content: 'Successfully updated chat activity settings.',
        });
    }

    public async addActivityRole(interaction: Subcommand.ChatInputCommandInteraction) {
        await interaction.deferReply({ withResponse: true });

        /**
         * Makes sure that the guild settings are created and cached.
         */
        await this.container.api.getGuildSettings(interaction.guildId!, { create: true });

        const type = interaction.options.getString('grant-type', true);
        const role = interaction.options.getRole('role', true);
        const requiredPoints = interaction.options.getNumber('required-points', true);

        const settings = await this.container.api.insertGuildActivityRole(interaction.guildId!, {
            grant_type: type,
            role_id: role.id,
            required_points: requiredPoints
        });

        if (settings.isErr()) {
            this.container.logger.error(settings.error);

            await interaction.editReply({
                content: `Failed to add role to activity role list. This has been forwarded to the developers.`
            });

            return;
        }

        return interaction.editReply({
            content: 'Successfully added role to activity role list.',
        });
    }

    public async addVoiceRoomLobby(interaction: Subcommand.ChatInputCommandInteraction) {
        await interaction.deferReply({ withResponse: true });

        /**
         * Makes sure that the guild settings are created and cached.
         */
        await this.container.api.getGuildSettings(interaction.guildId!, { create: true });

        const channel = interaction.options.getString('channel', true);
        const userLimit = interaction.options.getNumber('user-limit');
        const canRename = interaction.options.getBoolean('can-rename');
        const canLock = interaction.options.getBoolean('can-lock');
        const canAdjustLimit = interaction.options.getBoolean('can-adjust-limit');

        const settings = await this.container.api.createGuildVoiceRoomLobby(interaction.guildId!, channel, {
            user_limit: userLimit,
            can_rename: canRename,
            can_lock: canLock,
            can_adjust_limit: canAdjustLimit
        });

        if (settings.isErr()) {
            this.container.logger.error(settings.error);

            await interaction.editReply({
                content: `Failed to create voice room lobby. This has been forwarded to the developers.`
            });

            return;
        }

        return interaction.editReply({
            content: 'Successfully created voice room lobby.',
        });
    }

    public async updateVoiceRoomLobby(interaction: Subcommand.ChatInputCommandInteraction) {
        await interaction.deferReply({ withResponse: true });

        /**
         * Makes sure that the guild settings are created and cached.
         */
        await this.container.api.getGuildSettings(interaction.guildId!, { create: true });

        const channel = interaction.options.getString('channel', true);
        const userLimit = interaction.options.getNumber('user-limit');
        const canRename = interaction.options.getBoolean('can-rename');
        const canLock = interaction.options.getBoolean('can-lock');
        const canAdjustLimit = interaction.options.getBoolean('can-adjust-limit');

        const settings = await this.container.api.updateGuildVoiceRoomLobby(interaction.guildId!, channel, {
            user_limit: userLimit,
            can_rename: canRename,
            can_lock: canLock,
            can_adjust_limit: canAdjustLimit
        });

        if (settings.isErr()) {
            this.container.logger.error(settings.error);

            await interaction.editReply({
                content: `Failed to update voice room lobby. This has been forwarded to the developers.`
            });

            return;
        }

        return interaction.editReply({
            content: 'Successfully updated voice room lobby.',
        });
    }

    public async removeVoiceRoomLobby(interaction: Subcommand.ChatInputCommandInteraction) {
        await interaction.deferReply({ withResponse: true });

        /**
         * Makes sure that the guild settings are created and cached.
         */
        await this.container.api.getGuildSettings(interaction.guildId!, { create: true });

        const channel = interaction.options.getString('channel', true);
        const lobbies = await this.container.api.removeGuildVoiceRoomLobby(interaction.guildId!, channel);

        if (lobbies.isErr()) {
            this.container.logger.error(lobbies.error);

            await interaction.editReply({
                content: `Failed to remove voice room lobby. This has been forwarded to the developers.`
            });

            return;
        }

        return interaction.editReply({
            content: 'Successfully removed voice room lobby.',
        });
    }
}