// import type { VoiceRoomDetails, VoiceRoomSettingsDetails } from "@typical-developers/api-types/graphql";

import { container } from "@sapphire/pieces";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, CategoryChannel, Colors, ComponentType, EmbedBuilder, GuildMember, inlineCode, PermissionFlagsBits } from "discord.js";
import type { ActiveVoiceRoom, GuildSettings } from "@/lib/types/api";

/**
 * Check if a user owns the voice room.
 * @param guildId The id for the guild.
 * @param channelId The id for the channel attempting to be modified.
 * @param userId The id of the user attempting to modify the voice channel state.
 * @returns {Promise<boolean>} Whether the channel can be modified or not.
 */
export async function isOwner(guildId: string, roomId: string, userId: string): Promise<boolean> {
    const roomDetails = await container.api.getVoiceRoom(guildId, roomId);
    if (!roomDetails) return false;

    return roomDetails.current_owner_id === userId
        ? true
        : false;
}

/**
 * Check if a user is the original voice room owner.
 * @param guildId The id for the guild.
 * @param channelId The id for the channel attempting to be modified.
 * @param userId The id of the user attempting to modify the voice channel state.
 * @returns {Promise<boolean>} Whether the channel can be modified or not.
 */
export async function isOriginalOwner(guildId: string, roomId: string, userId: string): Promise<boolean> {
    const roomDetails = await container.api.getVoiceRoom(guildId, roomId);
    if (!roomDetails) return false;

    return roomDetails.original_owner_id === userId
        ? true
        : false;
}

/**
 * Generate an information embed for the voice room settings.
 * @param settings The settings for the voice room.
 * @returns {{ embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[]; }}}
 */
export function voiceRoomInfoEmbed(settings: ActiveVoiceRoom, originSettings: GuildSettings['spawn_rooms'][any]): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[]; } {
    const embed = new EmbedBuilder({
        color: Colors.Red,
        title: '🔊 Voice Room Management',
        description: `Created By: <@${settings.original_owner_id}>\n` +
            `Current Owner: <@${settings.current_owner_id}>\n` +
            `Original Channel: <#${settings.origin_channel_id}>\n` +
            `Locked State: ${inlineCode(`${settings.is_locked}`)}\n\n` +
            `The voice room owner can use the buttons below to manage the current state of the voice room.`
    });

    const components = [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder({
                type: ComponentType.Button,
                style: ButtonStyle.Secondary,
                custom_id: 'voice_room.rename',
                label: 'Rename Room',
                disabled: !originSettings.can_rename
            }),
            new ButtonBuilder({
                type: ComponentType.Button,
                style: ButtonStyle.Secondary,
                custom_id: 'voice_room.toggle_lock',
                label: 'Toggle Locked',
                disabled: !originSettings.can_lock
            }),
            new ButtonBuilder({
                type: ComponentType.Button,
                style: ButtonStyle.Secondary,
                custom_id: 'voice_room.adjust_limit',
                label: 'Adjust Limit',
                disabled: !originSettings.can_adjust_limit
            })
        ),
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder({
                type: ComponentType.Button,
                style: ButtonStyle.Success,
                custom_id: 'voice_room.reclaim_ownership',
                label: 'Reclaim Ownership'
            }),
            new ButtonBuilder({
                type: ComponentType.Button,
                style: ButtonStyle.Danger,
                custom_id: 'voice_room.close',
                label: 'Close Room',
                disabled: true
            }),
        )
    ];

    return { embeds: [embed], components };
}

/**
 * Get the settings for a voice room.
 * @param guildId The id of the guild.
 * @param originId The id of the channel that initated the creation.
 */
export async function voiceRoomSettingsFromOrigin(guildId: string, originId: string) {
    const rooms = (await container.api.getGuildSettings(guildId)).spawn_rooms;
    const settings = rooms.find(({ channel_id }) => channel_id === originId);

    return settings;
}

/**
 * Check the category permissions to make sure the bot can create voice rooms in it.
 * @param category The category to check permissions for.
 * @param clientMember The client member.
 * @returns {boolean}
 */
export function checkCategoryPermissions(category: CategoryChannel, clientMember: GuildMember): boolean {
    const hasCategoryPermission = category.permissionsFor(clientMember).has([
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.MoveMembers,
        PermissionFlagsBits.ManageChannels,
    ]);

    return hasCategoryPermission;
}