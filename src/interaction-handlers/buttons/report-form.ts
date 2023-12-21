import { InteractionHandler, InteractionHandlerTypes, container } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { ActionRowBuilder, ButtonInteraction, ComponentType, ModalBuilder, ModalSubmitFields, TextInputBuilder, TextInputStyle } from 'discord.js';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button,
	enabled: false
})
export class ReportFormButton extends InteractionHandler {
	public override async parse(interaction: ButtonInteraction) {
		if (!interaction.customId.startsWith('ReportForm')) return this.none();

		let [, type, place] = interaction.customId.split('.');

		return this.some<InteractionRun>({ type, place });
	}

	private get issueComponents() {
		return [
			new ActionRowBuilder<TextInputBuilder>().addComponents(
				new TextInputBuilder({
					type: ComponentType.TextInput,
					customId: 'username',
					style: TextInputStyle.Short,
					label: 'What is your Roblox username?',
					minLength: 3,
					max_length: 20
				})
			),
			new ActionRowBuilder<TextInputBuilder>().addComponents(
				new TextInputBuilder({
					type: ComponentType.TextInput,
					customId: 'version',
					style: TextInputStyle.Short,
					label: 'What version did the issue occur in?',
					max_length: 12
				})
			),
			new ActionRowBuilder<TextInputBuilder>().addComponents(
				new TextInputBuilder({
					type: ComponentType.TextInput,
					customId: 'media',
					style: TextInputStyle.Paragraph,
					label: 'Show some videos / images of the issue.',
					placeholder: 'Only certain URLs are supported. \n- YouTub\n- Streamable\n- Medal\n- URLs with media extensions'
				})
			),
			new ActionRowBuilder<TextInputBuilder>().addComponents(
				new TextInputBuilder({
					type: ComponentType.TextInput,
					customId: 'details',
					style: TextInputStyle.Paragraph,
					label: 'Do you have any other details?',
					required: false
				})
			)
		];
	}

	private getComponents(user: string, type: 'Issue') {
		let components: ActionRowBuilder<TextInputBuilder>[] = [];
		let cachedComponents: ModalSubmitFields | undefined;

		const CACHE = container.failedReports.cache;
		switch (type) {
			case 'Issue': {
				components = this.issueComponents;
				cachedComponents = CACHE.issueReports.get<ModalSubmitFields>(user);
				break;
			}
			default:
				break;
		}

		if (cachedComponents) {
			for (let [index, component] of components.entries()) {
				const COMPONENT = component.components[0].toJSON();
				const FIELD = cachedComponents.getField(COMPONENT.custom_id);

				if (!FIELD) continue;

				components[index].components[0].setValue(FIELD.value);
			}
		}

		return components;
	}

	public override async run(interaction: ButtonInteraction, options: InteractionRun) {
		let { type, place } = options;

		if (type !== 'Issue') return;

		const COMPONENTS = this.getComponents(interaction.user.id, type);
		const MODAL = new ModalBuilder({
			title: `Report ${type} in ${place}`,
			customId: `ReportForm.${type}.${place}`,
			components: COMPONENTS
		});

		return interaction.showModal(MODAL);
	}
}

interface InteractionRun {
	type: string;
	place: string;
}
