import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, Message } from 'discord.js';

@ApplyOptions<Listener.Options>({
	event: Events.MessageCreate,
	once: false,
	enabled: false
})
export class MediaOnlyListener extends Listener {
	readonly channels: string[] = ['1086472593894277190', '1063479705723998359'];

	readonly regexes = [
		'(?<media>.+/.+.(jpg|jpeg|png|gif|mp4|mov))',
		'(?<youtube>youtu(.be/.+|be.com/(watch?v=.+)))',
		'(?<streamable>streamable.com/.+)',
		'(?<imgur>imgur.com/.+)',
		'(?<medal>medal.tv/.+)',
		'(?<tiktok>tiktok.com/@.+/video/.+|vm.tiktok.com/.+)'
	];

	public override async run(message: Message) {
		if (!this.channels.includes(message.channelId)) return;

		const CONTENTS = message.content.split(/(?:\n| )+/);
		const REGEX = new RegExp(`^https?:\/\/(www\.)?(${this.regexes.join('|')})$`);

		let hasLink = false;
		for (let content of CONTENTS) {
			const RESULT = REGEX.exec(content);

			if (!RESULT) continue;

			hasLink = true;
			break;
		}

		if (!message.attachments.size && !hasLink) message.delete();
		return;
	}
}
