import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, Client, ActivityType } from 'discord.js';
import noblox, { type UniverseInformation } from 'noblox.js';

interface CountdownDetails { value: number | null, string: string | null, remaining: "SECONDS" | "MINUTES" | "HOURS" | "DAYS" | null }

@ApplyOptions<Listener.Options>({
	event: Events.ClientReady,
	once: true
})
export class ReadyListener extends Listener {
	private statusUpdate: number = 10;
	private currentStatus: "COUNTDOWN" | "OAK_PLAYING" | "ALL_PLAYING" = "COUNTDOWN";
	private oakPlaying: number = 0;

	// References from https://stackabuse.com/javascript-get-number-of-days-between-dates
	private countdown(end: Date, start: Date = new Date(Date.now())): CountdownDetails {
		const second = 1000;
		const minute = second * 60;
		const hour = minute * 60;
		const day = hour * 24;

		const diff = end.getTime() - start.getTime();

		const daysLeft = Math.floor(diff / day);
		const hoursLeft = Math.round(diff / hour);
		const minutesLeft = Math.round(diff / minute);
		const secondLeft = Math.round(diff / second);

		switch (true) {
			case secondLeft <= 0:
				return {
					value: null,
					string: null,
					remaining: null
				};
			case secondLeft < 60:
				return {
					value: secondLeft,
					string: secondLeft > 1 ? `${secondLeft} seconds` : `${secondLeft} second`,
					remaining: "SECONDS"
				}
			case minutesLeft < 60:
				return {
					value: minutesLeft,
					string: minutesLeft > 1 ? `${minutesLeft} minutes` : `${minutesLeft} minute`,
					remaining: "MINUTES"
				}
			case hoursLeft < 24:
				return {
					value: hoursLeft,
					string: `${hoursLeft} hours`,
					remaining: "HOURS"	
				}
			default:
				return {
					value: hoursLeft, // Uses hours because it's the total between the days and hours
					string: daysLeft > 1 ? `${daysLeft} days ${hoursLeft % 24} hours` : `${daysLeft} day ${hoursLeft % 24} hours`,
					remaining: "DAYS"
				}
		}
	}

	private async players(universe: number, oldPlaying: number) {
		const game = (await noblox.getUniverseInfo(universe).catch(() => null)) as unknown as UniverseInformation[];
		if (!game) return oldPlaying;

		let playing = game[0].playing;
		if (typeof playing !== 'number' || playing === oldPlaying) {
			return oldPlaying;
		}

		return playing;
	}

	private async statusInverval(client: Client) {
		switch (this.currentStatus) {
			case "COUNTDOWN":
				this.currentStatus = "OAK_PLAYING";

				const time = this.countdown(new Date("Jan 1, 2024 00:00:00 UTC-05:00"));
				if (time.value === null) {
					client.user?.setActivity({
						type: ActivityType.Watching,
						name: `New Year 2024!`
					});

					break;
				}

				client.user?.setActivity({
					type: ActivityType.Watching,
					name: `2023 tick away・${time.string}`
				});

				break;
			case "OAK_PLAYING":
				this.currentStatus = "COUNTDOWN";
				this.oakPlaying = await this.players(3666294218, this.oakPlaying);

				client.user?.setActivity({
					type: ActivityType.Watching,
					name: `Oaklands・${this.oakPlaying} playing`
				});

				break;
		}

		setTimeout(() => {
			return this.statusInverval(client);
		}, this.statusUpdate * 1000);
	}

	public override async run(client: Client) {
		this.statusInverval(client);
	}
}
