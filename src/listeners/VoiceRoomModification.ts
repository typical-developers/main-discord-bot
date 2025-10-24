import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, VoiceState } from 'discord.js';

@ApplyOptions<Listener.Options>({
    event: Events.VoiceStateUpdate,
    once: false
})
export class VoiceRoomModification extends Listener {
    public override async run(previous: VoiceState, current: VoiceState) {
        if (!previous.channel || !current.member) return;

        const settings = await this.container.api.guilds.getGuildSettings(current.guild.id);
        if (settings.isErr()) return;

        const channel = await previous.channel.fetch();
        const room = await this.container.api.guilds.getVoiceRoom(current.guild.id, previous.channel.id);
        if (room.isErr()) return;

        // If there are no more members in the voice room, delete the room.
        if (channel.members.size <= 0) {
            const status = await this.container.api.guilds.deleteVoiceRoom(current.guild.id, previous.channel.id);
            if (status.isErr()) return;

            await channel.delete('Automated Action - No users in voice room.');
            return;
        }

        // If there are still members in the voice room and the user that left is the current owner, transfer ownership.
        if (room.value.data.current_owner_id === current.member.id) {
            const nextMember = channel.members.first();
            if (!nextMember) {
                this.container.logger.warn('Unable to transfer ownership, no next member was found in the voice room.');
                return
            }

            const status = await this.container.api.guilds.updateVoiceRoom(current.guild.id, previous.channel.id, {
                current_owner_id: nextMember.id
            });
            if (status.isErr()) {
                this.container.logger.error('Unable to transfer ownership, failed to update voice room.');
                return;
            }

            return;
        }
    }
}
