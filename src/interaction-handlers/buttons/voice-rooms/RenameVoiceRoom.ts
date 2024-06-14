import { InteractionHandler, InteractionHandlerTypes, } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { ActionRowBuilder, ButtonInteraction, ComponentType, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button
})
export class RenameVoiceRoom extends InteractionHandler {
    public override async parse({ customId }: ButtonInteraction) {
        if (customId !== 'voice_room.rename') return this.none();

        return this.some();
    }

    public get components() {
        return [
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder({
                    type: ComponentType.TextInput,
                    customId: 'channel_name',
                    label: 'New Channel Name',
                    style: TextInputStyle.Short,
                    maxLength: 50,
                    required: true
                })
            )
        ];
    }

    public async run(interaction: ButtonInteraction) {
        const modal = new ModalBuilder({
            title: 'Rename Voice Room',
            customId: 'voice_room.rename_submit',
            components: this.components
        });

        return interaction.showModal(modal);
    }
}