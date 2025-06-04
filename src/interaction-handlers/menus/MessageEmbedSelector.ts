import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import {
    ActionRow,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    StringSelectMenuBuilder,
    StringSelectMenuComponent,
    StringSelectMenuInteraction
} from 'discord.js';
import { createMessageEmbed, getMessageContent, parseMessageLink } from '#/lib/util/message-embeds';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.SelectMenu
})
export class MessageEmbedSelector extends InteractionHandler {
    public override async parse(interaction: StringSelectMenuInteraction) {
        if (interaction.customId !== 'MessageEmbedSelector') return this.none();

        return this.some();
    }

    private getMessageMenu(components: StringSelectMenuInteraction['message']['components'], defaultLink: string) {
        const menu = components.find(row =>
            row.components.some(({ type, customId }) =>
                type === ComponentType.StringSelect
                && customId === 'MessageEmbedSelector'
            )
        ) as ActionRow<StringSelectMenuComponent> | undefined;

        if (!menu) {
            return null;
        }

        const newOptions = menu.components[0].options.reduce((acc, curr) => {
            if (curr.value === defaultLink) {
                curr.default = true;
            }
            else {
                curr.default = false;
            }
            
            return acc
        }, menu.components[0].options);

        // Originally, I was going to try reusing the old component.
        // However, they're in a read-only state, which made me realize they shouldn't be modified.
        // Instead, we just make a new row and use that.
        const otherMessages = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder({
                customId: "MessageEmbedSelector",
                options: newOptions
            })
        )
        
        return otherMessages;
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
            return await interaction.editReply({
                content: 'Sorry, but this message no longer exists.'
            });
        };

        const formattedLink = `https://discord.com/channels/${messageLink.guildId}/${messageLink.channelId}/${messageLink.messageId}`;

        const embeds = await createMessageEmbed(message);
        const jumpToButton = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder({
                style: ButtonStyle.Link,
                label: 'Jump to Original',
                url: formattedLink
            })
        );

        const otherMessages = this.getMessageMenu(interaction.message.components, formattedLink)
        const components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [jumpToButton];

        if (otherMessages) {
            components.push(otherMessages);
        }

        return await interaction.editReply({ embeds, components });
    }
}