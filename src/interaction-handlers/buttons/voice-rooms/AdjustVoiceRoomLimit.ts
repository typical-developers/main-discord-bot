import { InteractionHandler, InteractionHandlerTypes, } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { ActionRowBuilder, ButtonInteraction, ComponentType, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { isOwner } from '#lib/util/voice-rooms';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button
})
export class RenameVoiceRoom extends InteractionHandler {
    public override async parse(interaction: ButtonInteraction) {
        if (!interaction.guildId) return this.none();
        if (interaction.customId !== 'voice_room.adjust_limit') return this.none();

        if (!(await isOwner(interaction.guildId, interaction.channelId, interaction.user.id))) {
            interaction.reply({
                content: 'You are not the owner of this voice room!',
                ephemeral: true
            });

            return this.none();
        };

        return this.some();
    }

    public get components() {
        return [
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder({
                    type: ComponentType.TextInput,
                    customId: 'user_limit',
                    label: 'User Limit',
                    style: TextInputStyle.Short,
                    placeholder: 'More than one, greater or equal to the original limit.',
                    maxLength: 4,
                    required: true
                })
            )
        ];
    }

    public async run(interaction: ButtonInteraction) {
        const modal = new ModalBuilder({
            title: 'Rename Voice Room',
            customId: 'voice_room.adjust_limit_submit',
            components: this.components
        });

        return interaction.showModal(modal);
    }
}