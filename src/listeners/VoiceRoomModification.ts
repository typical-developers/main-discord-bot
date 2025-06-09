import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, VoiceState } from 'discord.js';
import { getVoiceRoom } from '#/lib/util/voice-rooms';

@ApplyOptions<Listener.Options>({
    event: Events.VoiceStateUpdate,
    once: false
})
export class VoiceRoomModification extends Listener {
    public override async run(previous: VoiceState, current: VoiceState) {
        if (!previous.channel) return;
        if (!current.member) return;
        if (!previous.guild.id && !current.guild.id) return;

        const guildSettings = await this.container.api.getGuildSettings(previous.guild.id);
        if (guildSettings.isErr()) {
            this.container.logger.error(guildSettings.error);
            return;
        }

        const voiceRoom = await getVoiceRoom(previous.guild.id, previous.channel.id);
        if (voiceRoom.isErr()) return;

        const { room } = voiceRoom.value;

        /**
         * Deletes the voice room if there are no longer users in the channel.
         */
        if (!previous.channel.members.size) {
            const status = await this.container.api.deleteGuildVoiceRoom(previous.guild.id, room.origin_channel_id, room.room_channel_id);
            if (status.isErr()) {
                this.container.logger.error(status.error);
                return;
            }

            await previous.channel.delete(`Automated Action - No users in voice room.`);
            return;
        }

        /**
         * Changes ownership if the current owner leaves.
         */
        if (current.member.id === room.current_owner_id && current.channelId !== room.room_channel_id) {
            const next = previous.channel.members.first();
            if (!next) return;

            await this.container.api.updateGuildVoiceRoom(previous.guild.id, room.origin_channel_id, room.room_channel_id, {
                current_owner_id: next.id
            });

            return;
        }
    }
}
