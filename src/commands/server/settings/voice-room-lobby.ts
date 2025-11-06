import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';
import { type ApplicationCommandSubCommandData, ApplicationCommandOptionType, ApplicationIntegrationType, InteractionContextType, MessageFlags, PermissionFlagsBits, type ApplicationCommandBooleanOptionData, type ApplicationCommandNumericOptionData } from 'discord.js';
import RequestError from '#/lib/extensions/RequestError';
import APIRequestError from '#/lib/extensions/APIRequestError';
import { APIErrorCodes } from '#/lib/types/api';

@ApplyOptions<Subcommand.Options>({
    description: 'Manage voice room lobby settings.',
    subcommands: [
        { name: 'add', type: 'method', chatInputRun: 'addVoiceRoomLobby' },
        { name: 'update', type: 'method', chatInputRun: 'updateVoiceRoomLobby' },
        { name: 'remove', type: 'method', chatInputRun: 'removeVoiceRoomLobby' },
    ],
    requiredUserPermissions: [ PermissionFlagsBits.Administrator ]
})
export class VoiceRoomLobbySettings extends Subcommand {
    
    private readonly _settingsOptions: (ApplicationCommandNumericOptionData | ApplicationCommandBooleanOptionData)[] = [
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
    ];

    private readonly _options: ApplicationCommandSubCommandData[] = [
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'add',
            description: 'Create a new lobby for creating voice rooms.',
            options: [
                {
                    type: ApplicationCommandOptionType.String,
                    name: 'channel',
                    description: 'The channel that will be considered the lobby.',
                    required: true,
                    autocomplete: true,
                },
                ...this._settingsOptions
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'update',
            description: 'Update a lobby for creating voice rooms.',
            options: [
                {
                    type: ApplicationCommandOptionType.String,
                    name: 'channel',
                    description: 'The channel that will be considered the lobby.',
                    required: true,
                    autocomplete: true,
                },
                ...this._settingsOptions
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'remove',
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
        }
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

    private _getOptions(interaction: Subcommand.ChatInputCommandInteraction) {
        return {
            user_limit: interaction.options.getNumber('user-limit') ?? undefined,
            can_rename: interaction.options.getBoolean('can-rename') ?? undefined,
            can_lock: interaction.options.getBoolean('can-lock') ?? undefined,
            can_adjust_limit: interaction.options.getBoolean('can-adjust-limit') ?? undefined
        };
    }

    public async addVoiceRoomLobby(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild)
            return;

        await interaction.deferReply({ withResponse: true, flags: [ MessageFlags.Ephemeral ] });

        const channelId = interaction.options.getString('channel', true);
        const channel = interaction.guild.channels.cache.get(channelId);
        if (!channel)
            return await interaction.editReply({
                content: 'The channel you specified does not exist.',
            });

        const settings = await this.container.api.guilds.fetch(interaction.guild.id, { createNew: true });
        if (settings.isErr()) {
            this.container.logger.error(settings.error);

            return await interaction.editReply({
                content: 'Something went wrong fetching the guild\'s settings. Please try again later.',
            });
        }

        if ((await settings.value.activeVoiceRooms.get(channelId)).isOk())
            return await interaction.editReply({
                content: 'This channel is an active voice room and cannot be set as a voice room lobby.',
            });

        const options = this._getOptions(interaction);
        const isSuccess = await settings.value.voiceRoomLobbies.create(channelId, options);

        if (isSuccess.isErr()) {
            if (APIRequestError.isAPIError(isSuccess.error)) {
                switch (isSuccess.error.code) {
                    case APIErrorCodes.VoiceRoomLobbyExists:
                        return await interaction.editReply({
                            content: 'This channel is already set as a voice room lobby.',
                        });
                    case APIErrorCodes.VoiceRoomLobbyIsVoiceRoom:
                        return await interaction.editReply({
                            content: 'This channel is an active voice room and cannot be set as a voice room lobby.',
                        });
                }
            }

            this.container.logger.error(isSuccess.error);
            return await interaction.editReply({
                content: 'There was an error creating the voice room lobby.',
            });
        }

        return await interaction.editReply({
            content: 'The voice room lobby has been created.',
        });
    }

    public async updateVoiceRoomLobby(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild)
            return;

        await interaction.deferReply({ withResponse: true, flags: [ MessageFlags.Ephemeral ] });

        const channelId = interaction.options.getString('channel', true);
        const channel = interaction.guild.channels.cache.get(channelId);
        if (!channel)
            return await interaction.editReply({
                content: 'The channel you specified does not exist.',
            });

        const settings = await this.container.api.guilds.fetch(interaction.guild.id, { createNew: true });
        if (settings.isErr()) {
            this.container.logger.error(settings.error);

            return await interaction.editReply({
                content: 'Something went wrong fetching the guild\'s settings. Please try again later.',
            });
        }

        const options = this._getOptions(interaction);
        const isSuccess = await settings.value.voiceRoomLobbies.update(channelId, options);
        if (isSuccess.isErr()) {
            if (!APIRequestError.isAPIError(isSuccess.error)) {
                this.container.logger.error(isSuccess.error);
                return await interaction.editReply({
                    content: 'There was an error updating the voice room lobby.',
                });
            }

            if (isSuccess.error.code === APIErrorCodes.VoiceRoomLobbyNotFound) {
                return await interaction.editReply({
                    content: 'This channel is not set as a voice room lobby.',
                });
            }
        }

        return await interaction.editReply({
            content: 'The voice room lobby has been updated.',
        });
    }

    public async removeVoiceRoomLobby(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild)
            return;

        await interaction.deferReply({ withResponse: true, flags: [ MessageFlags.Ephemeral ] });

        const channelId = interaction.options.getString('channel', true);

        const settings = await this.container.api.guilds.fetch(interaction.guild.id, { createNew: true });
        if (settings.isErr()) {
            this.container.logger.error(settings.error);

            return await interaction.editReply({
                content: 'Something went wrong fetching the guild\'s settings. Please try again later.',
            });
        }

        const isSuccess = await settings.value.voiceRoomLobbies.delete(channelId);
        if (isSuccess.isErr()) {
            if (APIRequestError.isAPIError(isSuccess.error) && isSuccess.error.isErrorCode(APIErrorCodes.VoiceRoomLobbyNotFound)) {
                return await interaction.editReply({
                    content: 'This channel is not set as a voice room lobby.',
                });
            }

            this.container.logger.error(isSuccess.error);
            return await interaction.editReply({
                content: 'There was an error deleting the voice room lobby.',
            });
        }

        return await interaction.editReply({
            content: 'The voice room lobby has been deleted.',
        });
    }
}