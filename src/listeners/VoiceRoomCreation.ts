import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { ChannelType, DiscordAPIError, Events, type VoiceBasedChannel, VoiceState, type DiscordErrorData } from 'discord.js';

@ApplyOptions<Listener.Options>({
    event: Events.VoiceStateUpdate,
    once: false
})
export class VoiceRoomCreation extends Listener {
    private async createNewVoiceRoom(state: VoiceState, settings: any) {
    }

    private async removeOldVoiceRoom(channel: VoiceBasedChannel) {
    }

    private async transferOwnership(channel: VoiceBasedChannel, userId: string) {
    }

    public override async run(previous: VoiceState, current: VoiceState) {
    }
}
