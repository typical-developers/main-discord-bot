import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, Message } from 'discord.js';

@ApplyOptions<Listener.Options>({
	event: Events.MessageCreate,
	once: false
})
export class MediaOnlyListener extends Listener {
	readonly channels: string[] = ['1086472593894277190', '1063479705723998359'];

	readonly regexes = [
		new RegExp(/(?<media>.+\/.+.(jpg|jpeg|png|gif|mp4|mov))/).source,
		new RegExp(/(?<youtube>youtu(\.be\/.+|be.com\/watch\?v=.+))/).source,
		new RegExp(/(?<streamable>streamable\.com\/.+)/).source,
		new RegExp(/(?<imgur>imgur\.com\/.+)/).source,
		new RegExp(/(?<medal>medal\.tv\/.+)/).source,
		new RegExp(/(?<tiktok>tiktok\.com\/@.+\/video\/.+|vm\.tiktok\.com\/.+)/).source
	];

	public override async run(message: Message) {
		if (!this.channels.includes(message.channelId)) return;

		const CONTENTS = message.content.split(/(?:\n| )+/);
		const REGEX = new RegExp(`^https?:\/\/(www\.)?(${this.regexes.join('|')})$`);

		const ROLES = (await message.member?.fetch())?.roles.cache;
		if (ROLES?.has('865737785457770527') || ROLES?.has('893988372585017374') || ROLES?.has('1035574540727767060')) return;

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
