import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, Message, inlineCode } from 'discord.js';

const GIF_DETECTION_REGEX = new RegExp(/http(s)?:\/\/(www\.)?((tenor|klipy|giphy).+|(.+(\.gif)))/gmi)
const CATEGORY_ID = "1065996313453404160";

@ApplyOptions<Listener.Options>({
    event: Events.MessageCreate,
    once: false
})
export class GIFSpamPrevention extends Listener {
    private maxGIFMessages = 2;
    private cooldown = 120_000;
    private channels = new Map<string, number[]>();

    private messageIncludesGIF(message: Message) {
        let hasGIF = message.attachments
            .filter(({ contentType }) => contentType?.toLowerCase().split(';')[0] === 'image/gif')
            .toJSON()
            .length > 0;

        // Only parse the content if this is still false.
        if (!hasGIF) {
            if (message.content.match(GIF_DETECTION_REGEX)) {
                hasGIF = true;
            }
        }

        return hasGIF
    }

    public override async run(message: Message) {
        if (!message.channel.isTextBased() || message.channel.isDMBased()) {
            return;
        }

        const parentChannel = await message.channel.parent?.fetch();
        if (!parentChannel) return;

        if (message.channel.isThread()) {
            const parentParentChannel = await parentChannel.parent?.fetch();
            if (!parentParentChannel || parentParentChannel.id !== CATEGORY_ID) {
                return;
            }
        } else if (parentChannel.id !== CATEGORY_ID) {
            return;
        }

        const hasGIF = this.messageIncludesGIF(message);
        if (!hasGIF) return;
        
        const now = Date.now();
        const cutoff = now - this.cooldown;
        const recentMessages = (this.channels.get(message.channelId) ?? []).filter((timestamp) => timestamp > cutoff);
        if (recentMessages.length >= this.maxGIFMessages) {
            await message.delete().catch(() => null);
            return;
        }

        recentMessages.push(now);
        this.channels.set(message.channelId, recentMessages);
    }
}