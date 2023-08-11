import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { ModalSubmitInteraction } from 'discord.js';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.ModalSubmit
})
export class ReportFormModal extends InteractionHandler {
	public override async parse(interaction: ModalSubmitInteraction) {
		if (!interaction.customId.startsWith('ReportForm')) return this.none();

		let [, type, place] = interaction.customId.split('.');

		return this.some<InteractionRun>({ type, place });
	}

	public override async run() {
		return;
	}
}

interface InteractionRun {
	type: string;
	place: string;
}
