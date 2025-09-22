import { ActionRowBuilder, ButtonInteraction, ComponentType, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { InteractionHandler, InteractionHandlerTypes, } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button
})
export class RenameVoiceRoom extends InteractionHandler {
    public override async parse(interaction: ButtonInteraction) {
        return this.some();
    }

    public async run(interaction: ButtonInteraction,) {
    }
}