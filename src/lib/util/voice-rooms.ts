import { container } from "@sapphire/pieces";
import { VoiceRoomDetails } from "@typical-developers/api-types/graphql";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors, ComponentType, EmbedBuilder, inlineCode } from "discord.js";

export async function isOwner(guildId: string, channelId: string, userId: string) {
    const roomDetails = await container.api.getVoiceRoom(guildId, channelId);
    if (!roomDetails) return false;

    return roomDetails.created_by_user_id === userId
        ? true
        : false;
}

export function voiceRoomInfoEmbed(settings: VoiceRoomDetails) {
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