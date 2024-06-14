import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuInteraction } from 'discord.js';
import { createMessageEmbed, getMessageContent, parseMessageLink } from '#lib/util/message-embeds';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.SelectMenu
})
export class MessageEmbedSelector extends InteractionHandler {
    public override async parse(interaction: StringSelectMenuInteraction) {
        if (interaction.customId !== 'MessageEmbedSelector') return this.none();

        return this.some();
    }

    public async run(interaction: StringSelectMenuInteraction) {
        const member = await interaction.guild?.members.fetch(interaction.user.id);
        if (!member) return;

        await interaction.deferReply({ fetchReply: true, ephemeral: true });

        const messageLink = await parseMessageLink(interaction.values[0]);
        if (!messageLink) {
            throw new Error('somehow, someway, a proper message link was not provided.');
        }

        const message = await getMessageContent(member, messageLink);
        if (!message) {
            return interaction.editReply({
                content: 'Sorry, but this message no longer exists.'
            });
        };

        const embed = await createMessageEmbed(message);
        const jumpToButton = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder({
                    style: ButtonStyle.Link,
                    label: 'Jump to Original',
                    url: `https://discord.com/channels/${messageLink.guildId}/${messageLink.channelId}/${messageLink.messageId}`
                })
            );

        return interaction.editReply({
            embeds: embed,
            components: [jumpToButton]
        });
    }
}