import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, VoiceState } from 'discord.js';

@ApplyOptions<Listener.Options>({
	event: Events.VoiceStateUpdate,
	once: false
})
export class ReadyListener extends Listener {
	public override async run(oldConnection: VoiceState, connection: VoiceState) {
		console.log(oldConnection, connection);
	}
}
