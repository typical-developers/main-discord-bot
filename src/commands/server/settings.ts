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
        if (interaction.guild == null) return;

        await interaction.deferReply({ withResponse: true, flags: [ MessageFlags.Ephemeral ] });
        const settings = await this.container.api.guilds.getGuildSettings(interaction.guild.id, { create: true });
        if (settings.isErr()) {
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
    }

    public async addVoiceRoomLobby(interaction: Subcommand.ChatInputCommandInteraction) {
    }

    public async updateVoiceRoomLobby(interaction: Subcommand.ChatInputCommandInteraction) {
    }

    public async removeVoiceRoomLobby(interaction: Subcommand.ChatInputCommandInteraction) {
    }
}