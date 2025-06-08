import { ButtonInteraction, MessageFlags, type VoiceBasedChannel } from 'discord.js';
import { InteractionHandler, InteractionHandlerTypes, } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { VoiceRoom, VoiceRoomLobby } from '#/lib/util/api';
import { isOwner, voiceRoomInfoCard, getVoiceRoom } from '#/lib/util/voice-rooms';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button
})
export class LockVoiceRoom extends InteractionHandler {
    public override async parse(interaction: ButtonInteraction) {
        if (interaction.customId !== 'voice_room.toggle_lock') return this.none();
        if (!interaction.channel?.isVoiceBased()) return this.none();

        const guildSettings = await this.container.api.getGuildSettings(interaction.guildId!); 
        if (guildSettings.isErr()) return this.none();

        const voiceRoom = await getVoiceRoom(interaction.guildId!, interaction.channelId!);
        if (voiceRoom.isErr()) return this.none();

        const { settings, room } = voiceRoom.value;

        if (!isOwner(interaction.user.id, room)) {
            await interaction.reply({
                content: 'You are not the owner of this voice room.',
                flags: [ MessageFlags.Ephemeral ],
            });

            return this.none();
        }

        return this.some({ settings, room });
    }

    private async _updateLimit(channel: VoiceBasedChannel, limit: number) {
        await channel.setUserLimit(limit);
    }

    public async run(interaction: ButtonInteraction, { settings, room }: { settings: VoiceRoomLobby, room: VoiceRoom }) {
        const isLocked = !room.is_locked
        const status = await this.container.api.updateGuildVoiceRoom(interaction.guildId!, room.origin_channel_id, room.room_channel_id, {
            is_locked: isLocked
        });

        if (status.isErr()) {
            await interaction.reply({
                content: 'Failed to toggle the lock state. Try again in a bit.',
                flags: [ MessageFlags.Ephemeral ],
            });

            return;
        }

        isLocked
            ? await this._updateLimit(interaction.channel as VoiceBasedChannel, 1)
            : await this._updateLimit(interaction.channel as VoiceBasedChannel, settings.user_limit);

        const infoCard = voiceRoomInfoCard(settings, status.value.data);
        await interaction.message.edit({
            components: infoCard,
            flags: [ MessageFlags.IsComponentsV2 ]
        });

        await interaction.reply({
            content: `The voice room has been ${isLocked ? 'locked' : 'unlocked'}.`,
            flags: [ MessageFlags.Ephemeral ],
        });
    }
}