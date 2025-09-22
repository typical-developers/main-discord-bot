import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { ChannelType, Events, type VoiceBasedChannel, VoiceState, MessageFlags } from 'discord.js';

@ApplyOptions<Listener.Options>({
    event: Events.VoiceStateUpdate,
    once: false
})
export class VoiceRoomCreation extends Listener {
    public override async run(_: VoiceState, current: VoiceState) {
    }
}
