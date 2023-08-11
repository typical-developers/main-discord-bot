import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { ActionRowBuilder, ButtonInteraction, ModalBuilder, TextInputBuilder } from 'discord.js';
import { FailedIssueReports, FailedUserReports } from '#lib/types/collections';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button
})
export class ReportFormModal extends InteractionHandler {
	public override async parse(interaction: ButtonInteraction) {
		if (!interaction.customId.startsWith('ReportForm')) return this.none();

		let [, type, place, isResubmit] = interaction.customId.split('.');
		let resubmit = !!isResubmit;

		return this.some<InteractionRun>({ type, place, resubmit });
	}

	private get issueFormComponents() {
		return [new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder({}))];
	}

	private get reportFormComponents() {
		return [new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder({}))];
	}

	public override async run(interaction: ButtonInteraction, options: InteractionRun) {
		let { type, place, resubmit } = options;

		const COMPONENTS = type === 'Issue' ? this.issueFormComponents : this.reportFormComponents;
		const MODAL = new ModalBuilder({
			title: `Report ${type} (${place})`,
			customId: `ReportForm.${type}.${place}`
		});

		if (resubmit) {
			const FAILEDREPORT = type === 'Issue' ? FailedIssueReports.get(interaction.user.id) : FailedUserReports.get(interaction.user.id);

			for (let [index, component] of COMPONENTS.entries()) {
				if (!FAILEDREPORT) break;

				const NEWCOMPONENT = component.toJSON().components[0];
				const OLDVALUE = FAILEDREPORT?.getTextInputValue(NEWCOMPONENT.custom_id) || '';

				COMPONENTS[index].components[0].setValue(OLDVALUE);
			}
		}

		MODAL.setComponents(COMPONENTS);

		return interaction.showModal(MODAL);
	}
}

interface InteractionRun {
	type: string;
	place: string;
	resubmit: boolean;
}
