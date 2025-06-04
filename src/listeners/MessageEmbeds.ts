import { type Message, StringSelectMenuBuilder, Events, type SelectMenuComponentOptionData, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { getMessageContent, parseMessageLinks, createMessageEmbed } from '#/lib/util/message-embeds';

@ApplyOptions<Listener.Options>({
    event: Events.MessageCreate,
    once: false,
    enabled: false,
})
export class MessageEmbeds extends Listener {
    public override async run(message: Message) {
        if (!message || !message.member || !message.content || message.author.bot) return;

        const messageLinks = parseMessageLinks(message.content);
        if (!messageLinks.length) return;

        // get the first message that the member can actually see for embedding.
        let currentMessage: Message | undefined;
        for (const link of messageLinks) {
            const messageDetails = await getMessageContent(message.member, link);
            if (!messageDetails) continue;

            currentMessage = messageDetails;
            break;
        }

        // unsure if there's a point to actually showing the pager if there's not even one they can see.
        // for the time being, just don't show it.
        if (!currentMessage) return;

        const embed = await createMessageEmbed(currentMessage);
        const jumpToButton = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder({
                    style: ButtonStyle.Link,
                    label: 'Jump to Original',
                    url: `https://discord.com/channels/${currentMessage.guildId}/${currentMessage.channelId}/${currentMessage.id}`
                })
            );

        if (messageLinks.length === 1) {
            return message.reply({
                embeds: embed,
                components: [jumpToButton],
                allowedMentions: { repliedUser: false }
            }).catch(() => null);
        }
        else {
            const options: SelectMenuComponentOptionData[] = messageLinks
                .map((link, index) =>
                    ({
                        label: `${index+1} - ID ${link.messageId}`,
                        value: `https://discord.com/channels/${link.guildId}/${link.channelId}/${link.messageId}`,
                        default: link.messageId === messageLinks[0].messageId ? true : false
                    })
                );

            const otherMessages = new ActionRowBuilder<StringSelectMenuBuilder>()
                .addComponents(
                    new StringSelectMenuBuilder({
                        customId: 'MessageEmbedSelector',
                        options: options
                    }
                ));

            return await message.reply({
                embeds: embed,
                components: [jumpToButton, otherMessages],
                allowedMentions: { repliedUser: false }
            }).catch(() => null);
        }
    }
}