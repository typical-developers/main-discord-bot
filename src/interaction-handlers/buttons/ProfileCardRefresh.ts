import { ActionRow, AttachmentBuilder, ButtonInteraction, ComponentType, MessageFlags, type MessageActionRowComponent } from 'discord.js';
import { InteractionHandler, InteractionHandlerTypes, } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { profileCard } from '#/lib/util/buttons';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button
})
export class ProfileCardRefresh extends InteractionHandler {
    public override async parse(interaction: ButtonInteraction) {
        if (!interaction.guildId || !interaction.channelId)
            return this.none();
        if (!interaction.customId.startsWith('profile_card_refresh'))
            return this.none();
        if (interaction.user.id !== interaction.message.interactionMetadata?.user.id) {
            await interaction.reply({
                content: "This is not your interaction!",
                flags: [ MessageFlags.Ephemeral ],
            });

            return this.none();
        }

        await interaction.message.edit({
            components: interaction.message.components
                .filter((c) => c.type === ComponentType.ActionRow)
                .map((c: ActionRow<MessageActionRowComponent>) => ({
                    ...c.toJSON(),
                    components: c.components.map((c) => ({
                        ...c.toJSON(),
                        disabled: true,
                    }))
                }))
        }).catch((e) => this.container.logger.error(e));

        return this.some();
    }

    public async run(interaction: ButtonInteraction) {
        await interaction.deferUpdate();

        const settings = await this.container.api.guilds.fetch(interaction.guildId!, { createNew: true });
        if (settings.isErr()) {
            this.container.logger.error(settings.error);

            await interaction.reply({
                content: 'Something went wrong while generating the profile card. This has been forwarded to the developers',
                flags: [ MessageFlags.Ephemeral ],
            });

            return;
        }

        const profile = await settings.value.members.fetch(interaction.user.id)
        if (profile.isErr()) {
            this.container.logger.error(profile.error);

            await interaction.reply({
                content: 'Something went wrong while generating the profile card. This has been forwarded to the developers',
                flags: [ MessageFlags.Ephemeral ],
            });

            return;
        }

        const card = await profile.value.generateProfileCard();
        if (card.isErr()) {
            this.container.logger.error(card.error);

            await interaction.reply({
                content: 'Something went wrong while generating the profile card. This has been forwarded to the developers',
                flags: [ MessageFlags.Ephemeral ],
            });

            return;
        }

        const attachment = new AttachmentBuilder(card.value, { name: 'profile-card.png' });
        return await interaction.editReply({
            files: [ attachment ],
            components: [ profileCard() ]
        });
    }
}