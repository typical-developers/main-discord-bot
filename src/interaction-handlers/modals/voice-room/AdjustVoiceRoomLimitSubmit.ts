import { ModalSubmitInteraction, MessageFlags, inlineCode, type VoiceBasedChannel } from 'discord.js';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.ModalSubmit
})
export class AdjustVoiceRoomLimitSubmit extends InteractionHandler {
    public override async parse(interaction: ModalSubmitInteraction) {
        return this.some();
    }

    public async run(interaction: ModalSubmitInteraction) {
    }
}