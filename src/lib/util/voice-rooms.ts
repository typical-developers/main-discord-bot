import { ContainerBuilder, ActionRowBuilder ,ButtonBuilder, ComponentType, SeparatorSpacingSize, inlineCode, ButtonStyle } from "discord.js";
import type { VoiceRoom } from '#/lib/types/api';

export function voiceRoomDetailsEmbed(room: VoiceRoom) {
    const settingsButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
            custom_id: 'voice_room.rename',
            label: 'Rename Room',
            disabled: !room.settings.can_rename 
        }),
        new ButtonBuilder({
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
            custom_id: 'voice_room.toggle_lock',
            label: 'Toggle Locked',
            disabled: !room.settings.can_lock
        }),
        new ButtonBuilder({
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
            custom_id: 'voice_room.adjust_limit',
            label: 'Adjust Limit',
            disabled: !room.settings.can_adjust_limit
        })
    );

    const stateButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            type: ComponentType.Button,
            style: ButtonStyle.Success,
            custom_id: 'voice_room.reclaim',
            label: 'Reclaim Ownership'
        }),
        new ButtonBuilder({
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
                `**Created By:** <@${room.creator_id}>\n` +
                `**Current Owner:** <@${room.current_owner_id}>\n` +
                `**Locked State** ${inlineCode(`${room.is_locked}`)}`,
        }])
        .addActionRowComponents(settingsButtons)
        .addActionRowComponents(stateButtons);
}
