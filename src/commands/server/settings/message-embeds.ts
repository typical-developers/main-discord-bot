import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';
import { type ApplicationCommandAutocompleteStringOptionData, type ApplicationCommandChannelOptionData, type ApplicationCommandOptionAllowedChannelTypes, type ApplicationCommandOptionData, type ApplicationCommandRoleOptionData, type ApplicationCommandStringOptionData, type ApplicationCommandSubCommandData, type ApplicationCommandSubGroupData, ApplicationCommandOptionType, ApplicationIntegrationType, ChannelType, InteractionContextType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import RequestError from '#/lib/extensions/RequestError';
import { isGuildBasedChannel } from '@sapphire/discord.js-utilities';
import type { GuildMessageEmbedsUpdateOptions } from '#/lib/structures/MessageEmbedSettings';

@ApplyOptions<Subcommand.Options>({
    description: 'Manage chat activity settings.',
    subcommands: [
        { name: 'settings', type: 'method', chatInputRun: 'updateMessageEmbedSettings' },
        {
            name: 'disabled-channels', type: 'group',
            entries: [
                { name: 'add', type: 'method', chatInputRun: 'addDisabledChannel' },
                { name: 'remove', type: 'method', chatInputRun: 'removeDisabledChannel' },
            ]
        },
        {
            name: 'ignored-channels', type: 'group',
            entries: [
                { name: 'add', type: 'method', chatInputRun: 'addIgnoredChannel' },
                { name: 'remove', type: 'method', chatInputRun: 'removeIgnoredChannel' },
            ]
        },
        {
            name: 'ignored-roles', type: 'group',
            entries: [
                { name: 'add', type: 'method', chatInputRun: 'addIgnoredRole' },
                { name: 'remove', type: 'method', chatInputRun: 'removeIgnoredRole' },
            ]
        }
    ],
    requiredUserPermissions: [ PermissionFlagsBits.Administrator ]
})
export class MessageEmbedsSettings extends Subcommand {
    private readonly _channelTypes: ApplicationCommandOptionAllowedChannelTypes[] = [
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
        ChannelType.GuildVoice,
        ChannelType.GuildStageVoice,
    ];

    private readonly _channelOption: ApplicationCommandChannelOptionData = {
        type: ApplicationCommandOptionType.Channel,
        name: 'channel',
        description: 'The channel to add to the list of disabled channels.',
        required: true,
        channel_types: this._channelTypes,
    };

    private readonly _roleOption: ApplicationCommandRoleOptionData = {
        type: ApplicationCommandOptionType.Role,
        name: 'role',
        description: 'The role to add to the list of ignored roles.',
        required: true,
    };

    private readonly _options: (ApplicationCommandSubCommandData | ApplicationCommandSubGroupData)[] = [
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'settings',
            description: 'Manage the message embed settings.',
            options: [
                {
                    type: ApplicationCommandOptionType.Boolean,
                    name: 'toggle',
                    description: 'Toggle message embeds on/off.'
                }
            ]
        },
        {
            type: ApplicationCommandOptionType.SubcommandGroup,
            name: 'disabled-channels',
            description: 'Manage the list of channels that are disabled for message embeds.',
            options: [
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: 'add',
                    description: 'Add a channel to the list of channels that are disabled for message embeds.',
                    options: [this._channelOption]
                },
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: 'remove',
                    description: 'Remove a channel from the list of channels that are disabled for message embeds.',
                    options: [this._channelOption]
                }
            ],
        },
        {
            type: ApplicationCommandOptionType.SubcommandGroup,
            name: 'ignored-channels',
            description: 'Manage the list of channels that are ignored for message embeds.',
            options: [
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: 'add',
                    description: 'Add a channel to the list of channels that are disabled for message embeds.',
                    options: [this._channelOption]
                },
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: 'remove',
                    description: 'Remove a channel from the list of channels that are disabled for message embeds.',
                    options: [this._channelOption]
                }
            ],
        },
        {
            type: ApplicationCommandOptionType.SubcommandGroup,
            name: 'ignored-roles',
            description: 'Manage the list of roles that are ignored for message embeds.',
            options: [
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: 'add',
                    description: 'Add a channel to the list of channels that are disabled for message embeds.',
                    options: [this._roleOption]
                },
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: 'remove',
                    description: 'Remove a channel from the list of channels that are disabled for message embeds.',
                    options: [this._roleOption]
                }
            ],
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

    private async _updateSettings(interaction: Subcommand.ChatInputCommandInteraction, options: GuildMessageEmbedsUpdateOptions) {
        if (!interaction.guild) return;
        
        await interaction.deferReply({ withResponse: true, flags: [ MessageFlags.Ephemeral ] });

        const settings = await this.container.api.guilds.fetch(interaction.guild.id, { createNew: true });
        if (settings.isErr()) {
            this.container.logger.error(settings.error);

            return await interaction.editReply({
                content: 'Something went wrong fetching the guild\'s settings. Please try again later.',
            });
        }

        const isSuccess = await settings.value.updateMessageEmbedSettings(options);
        if (isSuccess.isErr()) {
            this.container.logger.error(isSuccess.error);
            
            return await interaction.editReply({
                content: 'There was an error updating the message embed settings.',
            });
        }
        
        return await interaction.editReply({
            content: 'The message embed settings have been updated.',
        });
    }

    public async updateMessageEmbedSettings(interaction: Subcommand.ChatInputCommandInteraction) {
        const isEnabled = interaction.options.getBoolean('toggle') ?? undefined;

        if (isEnabled === undefined) {
            return await interaction.editReply({
                content: 'You must specify whether message embeds should be enabled or disabled.',
            });
        }

        return this._updateSettings(interaction, {
            is_enabled: isEnabled,
        });
    }

    public async addDisabledChannel(interaction: Subcommand.ChatInputCommandInteraction) {
        const channel = interaction.options.getChannel('channel', true);

        return this._updateSettings(interaction, {
            add_disabled_channel: channel.id,
        });
    }

    public async removeDisabledChannel(interaction: Subcommand.ChatInputCommandInteraction) {
        const channel = interaction.options.getChannel('channel', true);

        return this._updateSettings(interaction, {
            remove_disabled_channel: channel.id,
        });
    }

    public async addIgnoredChannel(interaction: Subcommand.ChatInputCommandInteraction) {
        const channel = interaction.options.getChannel('channel', true);

        return this._updateSettings(interaction, {
            add_ignored_channel: channel.id,
        });
    }

    public async removeIgnoredChannel(interaction: Subcommand.ChatInputCommandInteraction) {
        const channel = interaction.options.getChannel('channel', true);

        return this._updateSettings(interaction, {
            remove_ignored_channel: channel.id,
        });
    }

    public async addIgnoredRole(interaction: Subcommand.ChatInputCommandInteraction) {
        const role = interaction.options.getRole('role', true);

        return this._updateSettings(interaction, {
            add_ignored_role: role.id,
        });
    }

    public async removeIgnoredRole(interaction: Subcommand.ChatInputCommandInteraction) {
        const role = interaction.options.getRole('role', true);

        return this._updateSettings(interaction, {
            remove_ignored_role: role.id,
        });
    }
}