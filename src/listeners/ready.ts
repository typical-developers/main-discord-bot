import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, Client, ActivityType } from 'discord.js';
import noblox, { type UniverseInformation } from 'noblox.js';

@ApplyOptions<Listener.Options>({
	event: Events.ClientReady,
	once: true
})
export class ReadyListener extends Listener {
	public override async run(client: Client) {
		let pastPlaying: number = 0;

		setInterval(async () => {
			const game = await noblox.getUniverseInfo(3666294218).catch(() => null) as unknown as UniverseInformation[];
			if (!game) return;

			let playing = game[0].playing;
			if (typeof playing === 'number' && playing !== pastPlaying) {
				client.user?.setActivity({
					type: ActivityType.Watching,
					name: `Oaklands・${playing} playing`
				});

				pastPlaying = playing;
			}
		}, 5000);

		return;
	}
}
