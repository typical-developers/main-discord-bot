import { ContainerBuilder, ActionRowBuilder ,ButtonBuilder, ComponentType, SeparatorSpacingSize, inlineCode, ButtonStyle } from "discord.js";
import type VoiceRoom from "#/lib/structures/VoiceRoom";
import type VoiceRoomLobby from "#/lib/structures/VoiceRoomLobby";
import { emojis } from "#/lib/constants/emojis";

export function voiceRoomDetailsEmbed(room: VoiceRoom, settings: VoiceRoomLobby) {
    const settingsButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            emoji: { id: emojis.Rename },
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
            custom_id: 'voice_room.rename',
            label: 'Rename Room',
            disabled: !settings.canRename 
        }),
        new ButtonBuilder({
            emoji: { id: room.isLocked ? emojis.Unlock : emojis.Lock },
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
            custom_id: 'voice_room.toggle_lock',
            label: 'Toggle Locked',
            disabled: !settings.canLock
        }),
        new ButtonBuilder({
            emoji: { id: emojis.UserLimit },
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
            custom_id: 'voice_room.adjust_limit',
            label: 'Adjust Limit',
            disabled: !settings.canAdjustLimit
        })
    );

    const stateButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            emoji: { id: emojis.Reclaim },
            type: ComponentType.Button,
            style: ButtonStyle.Success,
            custom_id: 'voice_room.reclaim',
            label: 'Reclaim Ownership'
        }),
        new ButtonBuilder({
            emoji: { id: emojis.Close },
            type: ComponentType.Button,
            style: ButtonStyle.Danger,
            custom_id: 'voice_room.close',
            label: 'Close Room'
        })
    );

    return new ContainerBuilder()
        .addTextDisplayComponents([
            {
                type: ComponentType.TextDisplay,
                content: "### 🔉 Voice Room Management",
            },
            {
                type: ComponentType.TextDisplay,
                content: 'The voice room owner can use the buttons below to manage the state of the voice room.',
            }
        ])
        .addSeparatorComponents([{
            type: ComponentType.Separator,
            spacing: SeparatorSpacingSize.Large,
        }])
        .addTextDisplayComponents([{
            type: ComponentType.TextDisplay,
            content:
                `**Created By:** <@${room.creatorId}>\n` +
                `**Current Owner:** <@${room.currentOwnerId}>\n` +
                `**Locked State** ${inlineCode(`${!room.isLocked}`)}`,
        }])
        .addActionRowComponents(settingsButtons)
        .addActionRowComponents(stateButtons);
}
