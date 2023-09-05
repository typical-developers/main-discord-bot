import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { MessageLinkRegex } from '@sapphire/discord-utilities';
import {
	Collection,
	GuildMember,
	Message,
	type Channel,
	ChannelType,
	PermissionFlagsBits,
	Attachment,
	EmbedBuilder,
	TextChannel,
	EmbedType,
	inlineCode
} from 'discord.js';
import { BrandColors } from '#lib/types/constants';

interface MessageLinkGroup {
	guildId: string;
	channelId: string;
	messageId: string;
}

@ApplyOptions<Listener.Options>({
	event: Events.MessageCreate,
	once: false
})
export default class MessageListener extends Listener {
	public async fetchMessages(links: MessageLinkGroup[], member: GuildMember) {
		const CHANNELCACHE: Collection<string, Channel | null> = new Collection();
		const MESSAGES: Message[] = [];

		for (let link of links) {
			if (!CHANNELCACHE.get(link.channelId)) {
				CHANNELCACHE.set(link.channelId, await this.container.client.channels.fetch(link.channelId));
			}

			const CHANNEL = CHANNELCACHE.get(link.channelId);
			if (!CHANNEL) continue;
			if (CHANNEL.type === ChannelType.DM || CHANNEL.type === ChannelType.GroupDM || CHANNEL.type === ChannelType.GuildCategory) continue;

			if (CHANNEL.type === ChannelType.GuildText || CHANNEL.type === ChannelType.GuildVoice) {
				if (!CHANNEL.permissionsFor(member).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory])) continue;
			}

			if (CHANNEL.type === ChannelType.PrivateThread) {
				if (!CHANNEL.members.fetch(member.id)) continue;
			}

			const MESSAGE = await CHANNEL.messages.fetch(link.messageId);
			if (!MESSAGE) continue;

			MESSAGE.attachments = MESSAGE.attachments.filter((attachment: Attachment) => !attachment.url.endsWith('mp4'));
			if (MESSAGE?.embeds[0]?.data?.type !== EmbedType.AutoModerationMessage && !MESSAGE.content.length && !MESSAGE.attachments.first())
				continue;

			MESSAGES.push(MESSAGE);
		}

		if (MESSAGES.length === 0) return null;

		return MESSAGES;
	}

	public getMessageLinks(content: string) {
		const CONTENTS = content.split(/(?:\n| )+/);

		const LINKS: MessageLinkGroup[] = [];
		for (let content of CONTENTS) {
			if (LINKS.length === 5) break; // Messages can only have 5 embeds max, so we return 5 links to fetch.

			const RESULTGROUPS = MessageLinkRegex.exec(content)?.groups as unknown as MessageLinkGroup | undefined;
			if (!RESULTGROUPS) continue;

			if (LINKS.find((link) => link.messageId === RESULTGROUPS.messageId)) continue;

			LINKS.push(Object.assign({}, RESULTGROUPS));
		}

		if (LINKS.length === 0) return null;

		return LINKS;
	}

	public override async run(message: Message) {
		if (!message) return;
		if (message.author.bot) return;

		const LINKS = this.getMessageLinks(message.content);
		if (!LINKS) return;

		const MEMBER = await message.member?.fetch();
		if (!MEMBER) return;

		const MESSAGES = await this.fetchMessages(LINKS, MEMBER);
		if (!MESSAGES) return;

		const EMBEDS: EmbedBuilder[] = [];
		for (let message of MESSAGES) {
			let { author, content, createdTimestamp, attachments, url, guild, channel } = message;
			author = await author.fetch(true);

			const EMBED = [
				new EmbedBuilder({
					color: author.accentColor || BrandColors.White,
					author: {
						name:
							author.discriminator !== '0'
								? author.tag
								: author.globalName && author.globalName !== author.username
								? `${author.globalName} (@${author.username})`
								: `@${author.username}`,
						iconURL: author.displayAvatarURL({ extension: 'png', size: 256 }) || author.defaultAvatarURL
					},
					description: content + `\n\n[Jump to Original](${url})`,
					footer: {
						text: channel.type === ChannelType.GuildText ? `#${channel.name}` : (channel as unknown as TextChannel).name,
						iconURL: guild?.iconURL() || undefined
					},
					timestamp: createdTimestamp
				})
			];

			if (message?.embeds[0]?.data?.type === EmbedType.AutoModerationMessage) {
				let [rule, channel, _, keyword] = message.embeds[0].data.fields!;

				EMBED[0].setDescription(message.embeds[0].data.description!);
				EMBED[0].addFields([
					{ name: 'Rule', value: inlineCode(rule.value), inline: true },
					{ name: 'Channel', value: `<#${channel.value}>`, inline: true },
					{ name: 'Keyword', value: inlineCode(keyword.value), inline: true }
				]);
			}

			const ATTACHMENTS = Array.from(attachments.values()).splice(0, 4);
			ATTACHMENTS.forEach((attachment, index) => {
				if (index === 0) {
					EMBED[0].setURL(message.url).setImage(attachment.url);
					return;
				}

				EMBED.push(
					new EmbedBuilder({
						url: message.url,
						image: { url: attachment.url }
					})
				);
			});

			EMBEDS.push(...EMBED);
		}

		message
			.reply({
				embeds: EMBEDS,
				allowedMentions: {
					repliedUser: false
				}
			})
			.catch((err) => {
				console.log(err);
				return null;
			});

		return;
	}
}
