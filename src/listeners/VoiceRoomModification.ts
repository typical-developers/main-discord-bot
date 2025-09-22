import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, VoiceState } from 'discord.js';

@ApplyOptions<Listener.Options>({
    event: Events.VoiceStateUpdate,
    once: false
})
export class VoiceRoomModification extends Listener {
    public override async run(previous: VoiceState, current: VoiceState) {
    }
}
