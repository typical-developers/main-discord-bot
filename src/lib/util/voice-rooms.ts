import { container } from '@sapphire/framework';
import { ContainerBuilder, ActionRowBuilder ,ButtonBuilder, ComponentType, type APIComponentInContainer, SeparatorSpacingSize, inlineCode, ButtonStyle } from "discord.js";
import { okAsync, errAsync } from 'neverthrow';
// import type { VoiceRoomLobby, VoiceRoom } from "./api";

// export function isOwner(userId: string, room: VoiceRoom) {
//     return userId === room.current_owner_id;
// }

// export function isCreator(userId: string, room: VoiceRoom) {
//     return userId === room.created_by_user_id;
// }

// export async function getVoiceRoom(guildId: string, channelId: string) {
//     const settings = await container.api.getGuildSettings(guildId); 
//     if (settings.isErr()) return settings;

//     const room = settings.value.voice_rooms
//         .flatMap((r) => r.current_rooms)
//         .find((r) => r.room_channel_id === channelId);
//     const lobby = settings.value.voice_rooms.find((r) => room?.origin_channel_id === r.channel_id);
    
//     return okAsync({
//         settings: lobby!,
//         room: room!
//     });
// }

// export function voiceRoomInfoCard(settings: VoiceRoomLobby, room: VoiceRoom) {
//     const manageButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
//         new ButtonBuilder({
//             type: ComponentType.Button,
//             style: ButtonStyle.Secondary,
//             custom_id: 'voice_room.rename',
//             label: 'Rename Room',
//             disabled: !settings.can_rename 
//         }),
//         new ButtonBuilder({
//             type: ComponentType.Button,
//             style: ButtonStyle.Secondary,
//             custom_id: 'voice_room.toggle_lock',
//             label: 'Toggle Locked',
//             disabled: !settings.can_lock
//         }),
//         new ButtonBuilder({
//             type: ComponentType.Button,
//             style: ButtonStyle.Secondary,
//             custom_id: 'voice_room.adjust_limit',
//             label: 'Adjust Limit',
//             disabled: !settings.can_adjust_limit
//         })
//     );

//     const stateButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
//         new ButtonBuilder({
//             type: ComponentType.Button,
//             style: ButtonStyle.Success,
//             custom_id: 'voice_room.reclaim',
//             label: 'Reclaim Ownership'
//         }),
//         new ButtonBuilder({
//             type: ComponentType.Button,
//             style: ButtonStyle.Danger,
//             custom_id: 'voice_room.close',
//             label: 'Close Room'
//         })
//     );

//     const components: APIComponentInContainer[] = [
//         {
//             type: ComponentType.TextDisplay,
//             content: "### 🔉 Voice Room Management",
//         },
//         {
//             type: ComponentType.TextDisplay,
//             content: 'The voice room owner can use the buttons below to manage the state of the voice room.',
//         },
//         {
//             type: ComponentType.Separator,
//             spacing: SeparatorSpacingSize.Large,
//         },
//         {
//             type: ComponentType.TextDisplay,
//             content:
//                 `**Created By:** <@${room.created_by_user_id}>\n` +
//                 `**Current Owner:** <@${room.current_owner_id}>\n` +
//                 `**Locked State** ${inlineCode(`${room.is_locked}`)}`,
//         },
//         manageButtons.toJSON(),
//         stateButtons.toJSON(),
//     ];

//     const container = new ContainerBuilder({
//         type: ComponentType.Container,
//         components: components
//     });

//     return [ container ];
// };
