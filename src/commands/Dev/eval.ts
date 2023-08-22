import { Command, type ChatInputCommand } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import {
	type ApplicationCommandOptionData,
	ApplicationCommandOptionType,
	ComponentType,
	ModalBuilder,
	PermissionFlagsBits,
	TextInputStyle,
	ActionRowBuilder,
	TextInputBuilder
} from 'discord.js';
import { DEVELOPERWHITELIST } from '#lib/types/constants';

@ApplyOptions<ChatInputCommand.Options>({
	description: 'Authorized users only. Be careful when not running the command silently in a public chat.'
})
export class EvalCommand extends Command {
	readonly commandOptions: ApplicationCommandOptionData[] = [
		{
			type: ApplicationCommandOptionType.Boolean,
			name: 'ephemeral',
			description: 'Whether the response shows in chat to everyone.',
			required: true
		},
		{
			type: ApplicationCommandOptionType.Boolean,
			name: 'file-out',
			description: 'Whether the output should be put into a file.',
			required: true
		},
		{
			type: ApplicationCommandOptionType.String,
			name: 'compiler',
			description: "What code you're compiling (defaults to javascript).",
			choices: [
				{ name: 'Javascript', value: 'js' },
				{ name: 'Typescript', value: 'ts' }
			]
		}
	];

	public override registerApplicationCommands(registry: ChatInputCommand.Registry) {
		registry.registerChatInputCommand({
			name: this.name,
			description: this.description,
			options: this.commandOptions,
			defaultMemberPermissions: PermissionFlagsBits.Administrator
		});
	}

	public override async chatInputRun(interaction: ChatInputCommand.Interaction) {
		if (!DEVELOPERWHITELIST.includes(interaction.user.id)) {
			return interaction.reply({
				content: 'Only developers can evaluate code.'
			});
		}

		const EPHEMERAL = interaction.options.getBoolean('ephemeral', true);
		const FILEOUT = interaction.options.getBoolean('file-out', true);
		const COMPILER = interaction.options.getString('compiler') || 'js';

		const MODAL = new ModalBuilder({
			customId: `Eval.${EPHEMERAL}.${FILEOUT}.${COMPILER}`,
			title: 'Run code',
			components: [
				new ActionRowBuilder<TextInputBuilder>().addComponents(
					new TextInputBuilder({
						type: ComponentType.TextInput,
						customId: 'code',
						style: TextInputStyle.Paragraph,
						label: 'Code',
						required: true
					})
				)
			]
		});

		return interaction.showModal(MODAL);
	}
}
