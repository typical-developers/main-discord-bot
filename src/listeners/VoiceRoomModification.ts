import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, VoiceState } from 'discord.js';

@ApplyOptions<Listener.Options>({
    event: Events.VoiceStateUpdate,
    once: false
})
export class VoiceRoomModification extends Listener {
    public override async run(previous: VoiceState, current: VoiceState) {
        if (!previous.channel || !current.member)
            return;

        const settings = await this.container.api.guilds.fetch(current.guild.id, { createNew: true });
        if (settings.isErr())
            return;

        if (settings.value.voiceRoomLobbies.cache.has(previous.channel.id))
            return;

        const { activeVoiceRooms } = settings.value;
        const channel = await previous.channel.fetch();
        const room = await activeVoiceRooms.get(channel.id);
        if (room.isErr())
            return;

        // If there are no more members in the voice room, delete the room.
        if (channel.members.size <= 0) {
            const status = await room.value.delete();
            if (status.isErr()) return;

            await channel.delete('Automated Action - No users in voice room.');
            return;
        }

        // If there are still members in the voice room and the user that left is the current owner, transfer ownership.
        if (room.value.isOwner(current.member.id)) {
            const nextMember = channel.members.first();
            if (!nextMember) {
                this.container.logger.warn('Unable to transfer ownership, no next member was found in the voice room.');
                return
            }

            const status = await room.value.update({ current_owner_id: nextMember.id });
            if (status.isErr()) {
                this.container.logger.error('Unable to transfer ownership, failed to update voice room.');
                return;
            }

            return;
        }
    }
}
