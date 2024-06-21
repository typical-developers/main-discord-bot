import type { VoiceRoomDetails, VoiceRoomSettingsDetails } from "@typical-developers/api-types/graphql";
import { container } from "@sapphire/pieces";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors, ComponentType, EmbedBuilder, inlineCode } from "discord.js";

/**
 * Check if a user owns the voice room.
 * @param guildId The id for the guild.
 * @param channelId The id for the channel attempting to be modified.
 * @param userId The id of the user attempting to modify the voice channel state.
 * @returns {Promise<boolean>} Whether the channel can be modified or not.
 */
export async function isOwner(guildId: string, channelId: string, userId: string): Promise<boolean> {
    const roomDetails = await container.api.getVoiceRoom(guildId, channelId);
    if (!roomDetails) return false;

    return roomDetails.current_owner_id === userId
        ? true
        : false;
}

/**
 * Generate an information embed for the voice room settings.
 * @param settings The settings for the voice room.
 * @returns {{ embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[]; }}}
 */
export function voiceRoomInfoEmbed(settings: VoiceRoomDetails, originSettings: VoiceRoomSettingsDetails): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[]; } {
    const embed = new EmbedBuilder({
        color: Colors.Red,
        title: '🔊 Voice Room Management',
        description: `Created By: <@${settings.created_by_user_id}>\n` +
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
        )
    ];

    return { embeds: [embed], components };
}

/**
 * Get the settings for a voice room.
 * @param guildId The id of the guild.
 * @param originId The id of the channel that initated the creation.
 * @returns {Promise<VoiceRoomSettingsDetails>}
 */
export async function voiceRoomSettingsFromOrigin(guildId: string, originId: string): Promise<VoiceRoomSettingsDetails> {
    const rooms = (await container.api.getGuildSettings(guildId)).voice_rooms;
    const index = rooms.findIndex(({ voice_channel_id }) => voice_channel_id === originId);

    return rooms[index];
}