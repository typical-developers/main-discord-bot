import { ButtonInteraction, MessageFlags, type VoiceBasedChannel } from 'discord.js';
import { InteractionHandler, InteractionHandlerTypes, } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { VoiceRoom, VoiceRoomLobby } from '#/lib/util/api';
import { isCreator, getVoiceRoom } from '#/lib/util/voice-rooms';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button
})
export class ReclaimVoiceRoom extends InteractionHandler {
    public override async parse(interaction: ButtonInteraction) {
        if (interaction.customId !== 'voice_room.reclaim') return this.none();
        if (!interaction.channel?.isVoiceBased()) return this.none();

        const guildSettings = await this.container.api.getGuildSettings(interaction.guildId!); 
        if (guildSettings.isErr()) return this.none();

        const voiceRoom = await getVoiceRoom(interaction.guildId!, interaction.channelId!);
        if (voiceRoom.isErr()) return this.none();

        const { room } = voiceRoom.value;

        if (!isCreator(interaction.user.id, room)) {
            await interaction.reply({
                content: 'You are not the creator of this voice room.',
                flags: [ MessageFlags.Ephemeral ],
            });

            return this.none();
        }

        if (room.current_owner_id === interaction.user.id) {
            await interaction.reply({
                content: 'You already have control over this voice room.',
                flags: [ MessageFlags.Ephemeral ],
            });

            return this.none();
        }

        return this.some(room);
    }

    public async run(interaction: ButtonInteraction, room: VoiceRoom) {
        const status = await this.container.api.updateGuildVoiceRoom(interaction.guildId!, room.origin_channel_id, room.room_channel_id, {
            current_owner_id: interaction.user.id
        });

        if (status.isErr()) {
            await interaction.reply({
                content: 'Failed to reclaim the voice room. Try again in a bit.',
                flags: [ MessageFlags.Ephemeral ],
            });

            return;
        }

        await interaction.reply({
            content: 'You have been granted control over this voice room.',
            flags: [ MessageFlags.Ephemeral ],
        });
    }
}