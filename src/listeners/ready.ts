import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, Client, ActivityType } from 'discord.js';
import noblox from 'noblox.js';

@ApplyOptions<Listener.Options>({
	event: Events.ClientReady,
	once: true
})
export class ReadyListener extends Listener {
	public override async run(client: Client) {
		if (!client) return;
		if (!client.user) return;

		let pastPlaying: number = 0;
		return setInterval(async () => {
			const game: any = await noblox.getUniverseInfo(3666294218).catch(() => null);
			if (!game) return;

			let playing = game[0].playing;
			if (typeof playing === 'number' && playing !== pastPlaying) {
				client.user?.setActivity({
					type: ActivityType.Watching,
					name: `Oaklands・${playing} playing`
				});

				pastPlaying = playing;
			}
		});
	}
}
