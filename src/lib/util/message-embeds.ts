import { container } from "@sapphire/pieces";
import { MessageLinkRegex } from "@sapphire/discord-utilities";
import { isGuildBasedChannel } from "@sapphire/discord.js-utilities";
import { GuildMember, type GuildBasedChannel, PermissionFlagsBits, User, type Channel, ChannelType, Message, EmbedBuilder, Colors } from "discord.js";

/**
 * Fetches all message links that are in a message.
 */
export function parseMessageLinks(content: string) {
    const contents = content.split(/(?:\n| )+/);
    const guilds = container.client.guilds.cache.map((g) => g.id);

    const links: { id: string, guildId: string, channelId: string }[] = [];
    for (const string of contents) {
        const result = MessageLinkRegex.exec(string)

        if (!result?.groups) continue;
        const { groups } = result;

        // duplicate link.
        if (links.find((link) => link.id === groups.messageId)) continue;

        // bot is not in the guild
        if (!guilds.includes(groups.guildId)) continue;

        links.push({
            id: groups.messageId,
            guildId: groups.guildId,
            channelId: groups.channelId,
        });
    }

    return links;
}

/**
 * Checks whether or not a member can view a specific channel.
 */
export function canViewChannel(member: GuildMember, channel: GuildBasedChannel) {
    return channel
        .permissionsFor(member)
        .has([
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ReadMessageHistory
        ]);
}

/**
 * Formats the most appropriate username for the author.
 */
export function getAuthorUsername(author: User) {
    if (author.discriminator !== '0') {
        return author.tag;
    }

    if (author.globalName !== null) {
        return `${author.globalName} (@${author.username})`;
    }

    return `@${author.username}`;
}

/**
 * Formats the most appropriate name for the channel.
 */
export function getGuildChannelName(channel: Channel) {
    if (!isGuildBasedChannel(channel)) return channel.id;

    switch (channel.type) {
        case ChannelType.GuildText:
        case ChannelType.GuildAnnouncement:
        case ChannelType.GuildVoice:
        case ChannelType.GuildStageVoice:
            return `${channel.guild.name} - #${channel.name}`
        default:
            return `${channel.guild.name} - ${channel.name}`
    }
}

/**
 * Fetches a message from a specific channel.
 * This will return null if the member cannot view the channel.
 */
export async function fetchMessage(member: GuildMember, { id, guildId, channelId }: { id: string, guildId: string; channelId: string;}) {
    const guild = await container.client.guilds.fetch(guildId);
    if (!guild) return null;

    const channel = await guild.channels.fetch(channelId);
    if (!channel) return null;
    if (!isGuildBasedChannel(channel)) return null;
    if (!canViewChannel(member, channel)) return null;

    const message = await channel.messages.fetch(id).catch(() => null);
    if (!message || !message.content.length && !message.attachments.size) return null;

    return message;
}

/**
 * Generates a message embed based on message contents.
 */
export async function generateMessageEmbed(message: Message) {
    const { author, content, createdTimestamp, attachments, url, guild, channel } = message;
    await author.fetch(true);

    const embed = new EmbedBuilder({
        color: author.accentColor || Colors.White,
        author: {
            name: getAuthorUsername(author),
            iconURL: author.displayAvatarURL({ extension: 'png', size: 256 }) || author.defaultAvatarURL
        },
        description: content,
        footer: {
            text: getGuildChannelName(channel),
            iconURL: guild?.iconURL() || undefined
        },
        timestamp: createdTimestamp
    });

    const embedImages = Array.from(attachments.values()).reduce<EmbedBuilder[]>((acc, curr, i) => {
        if (i === 0) {
            embed.setURL(url).setImage(curr.url);
            return acc;
        }

        return [
            ...acc,
            new EmbedBuilder({
                url: message.url,
                image: { url: curr.url }
            })
        ]
    }, []);

    return [embed, ...embedImages];
}