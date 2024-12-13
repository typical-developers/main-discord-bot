import { UserError } from '@sapphire/framework';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { ApplyOptions } from '@sapphire/decorators';
import {
    ApplicationCommandOptionType,
    CategoryChannel,
    ChannelType,
    GuildMember,
    PermissionFlagsBits,
    type ApplicationCommandSubCommandData,
    type ApplicationCommandSubGroupData,
} from 'discord.js';
import { checkCategoryPermissions } from '@/lib/util/voice-rooms';

@ApplyOptions<Subcommand.Options>({
    description: 'Manage settings for the current guild.',
    subcommands: [
        {
            name: 'spawn-rooms',
            type: 'group',
            entries: [
                { name: 'create', chatInputRun: 'createSpawnRoom' },
                { name: 'modify', chatInputRun: 'modifySpawnRoom' },
                { name: 'remove', chatInputRun: 'removeSpawnRoom' },
            ]
        },
        {
            name: 'activity-roles',
            type: 'group',
            entries: [
                { name: 'add', chatInputRun: 'addChatActivityRole' },
                { name: 'remove', chatInputRun: 'removeChatActivityRole' },
            ]
        },
        { name: 'activity-tracking', chatInputRun: 'modifyActivityTracking' }
    ]
})
export class Settings extends Subcommand {
    private readonly _options: (ApplicationCommandSubCommandData | ApplicationCommandSubGroupData)[] = [
        {
            type: ApplicationCommandOptionType.SubcommandGroup,
            name: 'spawn-rooms',
            description: "Manage the voice spawn rooms for the guild.",
            options: [
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: 'create',
                    description: 'Create a new spawn room.',
                    options: [
                        {
                            type: ApplicationCommandOptionType.String,
                            name: 'channel-id',
                            description: "Whether or not the room spawned can be locked.",
                            required: true,
                            autocomplete: true,
                        },
                        {
                            type: ApplicationCommandOptionType.Number,
                            name: 'user-limit',
                            description: "Whether or not the room spawned can be locked.",
                            min_value: 1,
                            max_value: 99
                        },
                        {
                            type: ApplicationCommandOptionType.Boolean,
                            name: 'can-rename',
                            description: "Whether or not the room spawned can be locked.",
                        },
                        {
                            type: ApplicationCommandOptionType.Boolean,
                            name: 'can-lock',
                            description: "Whether or not the room spawned can be locked.",
                        },
                        {
                            type: ApplicationCommandOptionType.Boolean,
                            name: 'can-adjust-limit',
                            description: "Whether or not the room spawned can be locked.",
                        }
                    ]
                },
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: 'modify',
                    description: 'Create a new spawn room.',
                    options: [
                        {
                            type: ApplicationCommandOptionType.String,
                            name: 'channel-id',
                            description: "Whether or not the room spawned can be locked.",
                            required: true,
                            autocomplete: true,
                        },
                        {
                            type: ApplicationCommandOptionType.Number,
                            name: 'user-limit',
                            description: "Whether or not the room spawned can be locked.",
                            min_value: 1,
                            max_value: 99
                        },
                        {
                            type: ApplicationCommandOptionType.Boolean,
                            name: 'can-rename',
                            description: "Whether or not the room spawned can be locked.",
                        },
                        {
                            type: ApplicationCommandOptionType.Boolean,
                            name: 'can-lock',
                            description: "Whether or not the room spawned can be locked.",
                        },
                        {
                            type: ApplicationCommandOptionType.Boolean,
                            name: 'can-adjust-limit',
                            description: "Whether or not the room spawned can be locked.",
                        }
                    ]
                },
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: 'remove',
                    description: 'Remove an existing spawn room.',
                    options: [
                        {
                            type: ApplicationCommandOptionType.String,
                            name: 'channel-id',
                            description: "Whether or not the room spawned can be locked.",
                            required: true,
                            autocomplete: true
                        }
                    ]
                }
            ]
        },
        {
            type: ApplicationCommandOptionType.SubcommandGroup,
            name: 'activity-roles',
            description: "Manage the activity roles for the guild.",
            options: [
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: 'add',
                    description: 'Add a new activity role.',
                    options: [
                        {
                            type: ApplicationCommandOptionType.String,
                            name: "type",
                            description: ".",
                            choices: [
                                { name: "Chat Tracking", value: "chat" },
                                { name: "Voice Tracking", value: "voice" },
                            ],
                            required: true
                        },
                        {
                            type: ApplicationCommandOptionType.String,
                            name: "role-id",
                            description: ".",
                            required: true,
                        },
                        {
                            type: ApplicationCommandOptionType.Number,
                            name: "required-points",
                            description: ".",
                            required: true,
                        },
                    ],
                },
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: 'remove',
                    description: 'Remove an existing activity role.',
                    options: [
                        {
                            type: ApplicationCommandOptionType.String,
                            name: "type",
                            description: ".",
                            choices: [
                                { name: "Chat Tracking", value: "chat" },
                                { name: "Voice Tracking", value: "voice" },
                            ],
                            required: true
                        },
                    ],
                }
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: 'activity-tracking',
            description: "Manage the activity tracking settings for the guild.",
            options: [
                {
                    type: ApplicationCommandOptionType.String,
                    name: "type",
                    description: ".",
                    choices: [
                        { name: "Chat Tracking", value: "chat" },
                        { name: "Voice Tracking", value: "voice" },
                    ],
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.Boolean,
                    name: "enabled",
                    description: "Enable / disable activity tracking."
                },
                {
                    type: ApplicationCommandOptionType.Number,
                    name: "points",
                    description: "The amount of points that should be granted for tracking."
                },
                {
                    type: ApplicationCommandOptionType.Number,
                    name: "cooldown",
                    description: "The duration in seconds until the next grant can be done."
                }
            ]
        },
    ];

    public override async registerApplicationCommands(registry: Subcommand.Registry) {
        registry
            .registerChatInputCommand({
                name: process.env.DEV_DEPLOYMENT === 'true'
                    ? `dev-${this.name}`
                    : this.name,
                description: this.description,
                options: this._options,
                defaultMemberPermissions: [PermissionFlagsBits.Administrator],
                dmPermission: false
            });
    }

    private _removeNullOptions<T extends Object>(options: T) {
        const settings = Object.entries(options)
            .reduce((acc, [k, v]) => {
                // Only add properties that are not null
                if (v !== null) {
                    acc[k as keyof T] = v;
                }

                return acc;
            }, {} as Partial<{ [K in keyof T]?: Exclude<T[K], null> | Exclude<T[K], null> }>);
    
        return settings;
    }

    public async createSpawnRoom(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return;

        const channelId = interaction.options.getString('channel-id', true);
        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);

        if (!channel) {
            throw new UserError({ identifier: "INVALID_CHANNEL", message: "This channel does not exist!" });
        }

        if (channel.type !== ChannelType.GuildVoice) {
            throw new UserError({ identifier: "INVALID_CHANNEL", message: "This channel is not a voice channel!" });
        }

        const voiceRoom = await this.container.api.getVoiceRoom(interaction.guild.id, channelId);
        if (voiceRoom) {
            throw new UserError({ identifier: "INVALID_CHANNEL", message: "You cannot set a voice room channel as a spawn room channel!" });
        }

        await interaction.deferReply({ fetchReply: true, ephemeral: true });

        if (!channel.parent) {
            return await interaction.editReply({
                content: 'The creation channel must be in a parent category.',
            });
        }

        const clientMember = await interaction.guild.members.fetch(interaction.client.user.id);
        const hasCategoryPermission = checkCategoryPermissions(channel.parent, clientMember);

        if (!hasCategoryPermission) {
            return await interaction.editReply({
                content: 'The bot is missing one or more permissions for creating voice rooms.',
            });
        }

        const options = this._removeNullOptions({
            user_limit: interaction.options.getNumber('user-limit'),
            can_rename: interaction.options.getBoolean('can-rename'),
            can_lock: interaction.options.getBoolean('can-lock'),
            can_adjust_limit: interaction.options.getBoolean('can-adjust-limit'),
        });

        const created = await this.container.api.createVoiceSpawnRoom(interaction.guild.id, channelId, options);

        return await interaction.editReply({
            content: `Successfully created a spawn room: <#${created.channel_id}>!`
        });
    }

    public async modifySpawnRoom(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return;

        const settings = await this.container.api.getGuildSettings(interaction.guild.id);
        const channelId = interaction.options.getString('channel-id', true);
        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        const currentOptions = settings.spawn_rooms.find(({ channel_id }) => channel_id === channelId);
        
        if (!channel) {
            throw new UserError({ identifier: "INVALID_CHANNEL", message: "This channel does not exist!" });
        }

        if (channel.type !== ChannelType.GuildVoice) {
            throw new UserError({ identifier: "INVALID_CHANNEL", message: "This channel is not a voice channel!" });
        }

        if (!currentOptions) {
            throw new UserError({
                identifier: 'INVALID_CHANNEL',
                message: 'This channel is not a valid spawn room.'
            });
        }

        await interaction.deferReply({ fetchReply: true, ephemeral: true });
        
        if (!channel.parent) {
            await this.container.api.deleteVoiceSpawnRoom(interaction.guild.id, channelId);
            return await interaction.editReply({
                content: `The spawn room is not in a parent category so it has been deleted.`
            });
        }

        const clientMember = await interaction.guild.members.fetch(interaction.client.user.id);
        const hasCategoryPermission = checkCategoryPermissions(channel.parent, clientMember);

        if (!hasCategoryPermission) {
            await this.container.api.deleteVoiceSpawnRoom(interaction.guild.id, channelId);
            return await interaction.editReply({
                content: 'The bot is missing one or more permissions for creating voice rooms in the parent category.',
            });
        }

        const options = this._removeNullOptions({
            user_limit: interaction.options.getNumber('user-limit'),
            can_rename: interaction.options.getBoolean('can-rename'),
            can_lock: interaction.options.getBoolean('can-lock'),
            can_adjust_limit: interaction.options.getBoolean('can-adjust-limit'),
        });

        if (!Object.keys(options).length) {
            throw new UserError({
                identifier: 'NO_SETTINGS',
                message: 'Please provide some settings to update.'
            });
        }

        
        const updated = await this.container.api.modifyVoiceSpawnRoom(interaction.guild.id, channelId, options);

        return await interaction.editReply({
            content: `Successfully updated the spawn room: <#${updated.channel_id}>!`
        });
    }

    public async removeSpawnRoom(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return;

        const settings = await this.container.api.getGuildSettings(interaction.guild.id);
        const channelId = interaction.options.getString('channel-id', true);
        const currentOptions = settings.spawn_rooms.find(({ channel_id }) => channel_id === channelId);
        
        if (!currentOptions) {
            throw new UserError({
                identifier: 'INVALID_CHANNEL',
                message: 'This channel is not a valid spawn room.'
            });
        }

        await interaction.deferReply({ fetchReply: true, ephemeral: true });

        const deleted = await this.container.api.deleteVoiceSpawnRoom(interaction.guild.id, channelId);

        if (deleted.success) {
            return await interaction.editReply({
                content: `Successfully removed the spawn room <#${channelId}>!`
            });
        }

        return await interaction.editReply({
            content: `Failed to remove the spawn room <#${channelId}>!`
        });
    }

    public async modifyActivityTracking(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return;
        
        const type = interaction.options.getString('type', true);
        const options = this._removeNullOptions({
            enabled: interaction.options.getBoolean('enabled'),
            points: interaction.options.getNumber('points'),
            cooldown: interaction.options.getNumber('cooldown'),
        });

        if (!Object.keys(options).length) {
            throw new UserError({
                identifier: 'NO_SETTINGS',
                message: 'Please provide some settings to update.'
            });
        }

        if (type !== 'chat' && type !== 'voice') {
            throw new UserError({
                identifier: 'INVALID_TYPE',
                message: 'The provided type is not valid.'
            });
        }

        await interaction.deferReply({ fetchReply: true, ephemeral: true });

        await this.container.api.modifyActivitySettings(interaction.guild.id, type, options);

        return await interaction.editReply({
            content: `Successfully updated ${type} activity tracking settings.`
        });
    }

    public async addChatActivityRole(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return;

        const type = interaction.options.getString('type', true);
        const roleId = interaction.options.getString('role-id', true);
        const requiredPoints = interaction.options.getNumber('required-points', true);

        if (type !== 'chat' && type !== 'voice') {
            throw new UserError({
                identifier: 'INVALID_TYPE',
                message: 'The provided type is not valid.'
            });
        }

        await interaction.deferReply({ fetchReply: true, ephemeral: true });

        const added = await this.container.api.addActivityRoles(interaction.guild.id, type, [{ role_id: roleId, required_points: requiredPoints }]);

        if (!added.length) {
            return await interaction.editReply({
                content: `No new role was added, it likely has already been added.`
            });
        }

        return await interaction.editReply({
            content: `Successfully added the activity role <@&${roleId}>.`
        });
    }
}