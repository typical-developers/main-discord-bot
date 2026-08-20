import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, Message, inlineCode } from 'discord.js';

const GIF_DETECTION_REGEX = new RegExp(/http(s)?:\/\/(www\.)?((tenor|klipy|giphy).+|(.+(\.gif|webp)))/gmi)
const CATEGORY_IDS = (process.env.GIF_DETECTION_CHANNEL_ID as unknown as string)
    .split(',')
    .map((categoryId) => categoryId.trim())
    .filter(Boolean);

@ApplyOptions<Listener.Options>({
    event: Events.MessageCreate,
    once: false
})
export class GIFSpamPrevention extends Listener {
    private maxGIFMessages = process.env.MAX_GIFS_BETWEEN_COOLDOWN as unknown as number;
    private cooldown = process.env.GIFS_COOLDOWN as unknown as number;
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
            if (!parentParentChannel || !CATEGORY_IDS.includes(parentParentChannel.id)) {
                return;
            }
        } else if (!CATEGORY_IDS.includes(parentChannel.id)) {
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