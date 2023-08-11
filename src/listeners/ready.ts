import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, Client } from 'discord.js';

@ApplyOptions<Listener.Options>({
	event: Events.ClientReady,
	once: true
})
export class ReadyListener extends Listener {
	public override async run(client: Client) {
		if (!client) return;
		if (!client.user) return;

	}
}
