import { container } from "@sapphire/pieces";
import { VoiceRoomDetails } from "@typical-developers/api-types/graphql";
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

    return roomDetails.created_by_user_id === userId
        ? true
        : false;
}

/**
 * Generate an information embed for the voice room settings.
 * @param settings The settings for the voice room.
 * @returns {{ embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[]; }}}
 */
export function voiceRoomInfoEmbed(settings: VoiceRoomDetails): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[]; } {
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
                label: 'Rename Room'
            }),
            new ButtonBuilder({
                type: ComponentType.Button,
                style: ButtonStyle.Secondary,
                custom_id: 'voice_room.toggle_lock',
                label: 'Toggle Locked'
            })
        )
    ];

    return { embeds: [embed], components };
}

export async function voiceRoomSettingsFromOrigin(guildId: string, originId: string) {
    const rooms = (await container.api.getGuildSettings(guildId)).voice_rooms;
    const index = rooms.findIndex(({ voice_channel_id }) => voice_channel_id === originId);

    return rooms[index];
}