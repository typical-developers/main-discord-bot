import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { AttachmentBuilder, ModalSubmitInteraction, codeBlock, inlineCode } from 'discord.js';
import { inspect } from 'util';
import { VM } from 'vm2';
import ts from 'typescript';
import { DEVELOPERWHITELIST, StatusEmbedCodes } from '#lib/types/constants';
import { createStatusEmbed } from '#lib/util/embeds';

// There are for the sandbox.
// There is probably a better way to do this, I just dont know what way.
import discordjs from 'discord.js';
import * as database from '#lib/util/database';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.ModalSubmit
})
export class ReportFormModal extends InteractionHandler {
	public override async parse(interaction: ModalSubmitInteraction) {
		if (!interaction.customId.startsWith('Eval')) return this.none();

		if (!DEVELOPERWHITELIST.includes(interaction.user.id)) {
			interaction.reply({
				content: 'Only developers can evaluate code.'
			});

			return this.none();
		}

		let [, ephemeral, fileOut, compiler] = interaction.customId.split('.');

		return this.some<InteractionRun>({
			ephemeral: JSON.parse(ephemeral),
			fileOut: JSON.parse(fileOut),
			compiler: compiler
		});
	}

	private async clean(text: any) {
		if (text && text.constructor.name == 'Promise') text = await text;

		if (typeof text !== 'string') text = inspect(text, { depth: 1 });

		text = text.replace(/`/g, '`' + String.fromCharCode(8203)).replace(/@/g, '@' + String.fromCharCode(8203));

		return text;
	}

	public override async run(interaction: ModalSubmitInteraction, options: InteractionRun) {
		let { ephemeral, fileOut, compiler } = options;

		await interaction.deferReply({ ephemeral, fetchReply: true });

		const SANDBOX = new VM({
			sandbox: {
				client: this.container.client,
				database: this.container.database,
				interaction: interaction,
				util: {
					djs: discordjs,
					database: database
				}
			}
		});

		const RAN = new Date().getTime();
		const RAWCODE = interaction.fields.getTextInputValue('code');
		try {
			let code = RAWCODE;
			if (compiler === 'ts') {
				code = ts.transpile(code);
			}

			const EVAL = SANDBOX.run(code);
			const CLEAN = await this.clean(EVAL);

			const EMBED = createStatusEmbed(StatusEmbedCodes.Success, {
				author: { name: 'Successfully ran code' },
				fields: [
					{ name: 'Took', value: inlineCode(`${new Date().getTime() - RAN}ms`), inline: true },
					{ name: 'Type', value: inlineCode(typeof EVAL), inline: true },
					{ name: 'Input', value: codeBlock(compiler, RAWCODE.slice(0, 1010)) },
					{ name: 'Output', value: codeBlock('json', CLEAN.slice(0, 1010)) }
				]
			});

			if (fileOut) {
				EMBED.spliceFields(3, 1);

				const ATTACHMENT = new AttachmentBuilder(Buffer.from(CLEAN, 'utf-8'), { name: `output.${compiler}` });

				await interaction.editReply({ embeds: [EMBED] });
				interaction.followUp({ ephemeral, files: [ATTACHMENT] });

				return;
			}

			interaction.editReply({
				embeds: [EMBED]
			});

			return;
		} catch (err) {
			const EMBED = createStatusEmbed(StatusEmbedCodes.Error, {
				author: { name: 'Failed to run code' },
				fields: [
					{ name: 'Took', value: inlineCode(`${new Date().getTime() - RAN}ms`), inline: true },
					{ name: 'Input', value: codeBlock('json', RAWCODE.slice(0, 1010)) },
					{ name: 'Error', value: codeBlock('xl', `${err}`) }
				]
			});

			interaction.editReply({
				embeds: [EMBED]
			});
		}
	}
}

interface InteractionRun {
	ephemeral: boolean;
	fileOut: boolean;
	compiler: string;
}
