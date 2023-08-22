import { InteractionHandler, InteractionHandlerTypes, container } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	EmbedBuilder,
	ModalSubmitFields,
	ModalSubmitInteraction,
	TextChannel
} from 'discord.js';
import noblox from 'noblox.js';
import { createStatusEmbed } from '#lib/util/embeds';
import { BrandColors, StatusEmbedCodes } from '#lib/types/constants';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.ModalSubmit
})
export class ReportSubmitModal extends InteractionHandler {
	readonly cooldown: { [key: string]: Date } = {};

	readonly mediaRegexs = [
		'(?<media>.+/.+.(jpg|jpeg|png|gif|mp4|mov))',
		'(?<youtube>youtu(.be/.+|be.com/(watch?v=.+)))',
		'(?<streamable>streamable.com/.+)',
		'(?<imgur>imgur.com/.+)',
		'(?<medal>medal.tv/.+)'
	];

	readonly reportChannels: { [key: string]: { [key: string]: string } } = {
		Oaklands: {
			Issue: '1117658035784007701'
		}
	};

	private setComponentsCache(interaction: ModalSubmitInteraction, type: string, remove?: boolean) {
		const CACHE = container.failedReports.cache;

		if (remove) {
			switch (type) {
				case 'Issue': {
					CACHE.issueReports.take<ModalSubmitFields>(interaction.user.id);
					break;
				}
				default:
					break;
			}
		} else {
			switch (type) {
				case 'Issue': {
					CACHE.issueReports.set<ModalSubmitFields>(interaction.user.id, interaction.fields);
					break;
				}
				default:
					break;
			}
		}
	}

	private submitErrorEmbed(
		interaction: ModalSubmitInteraction,
		type: 'COOLDOWN' | 'INVALID_USER' | 'INVALID_VERSION' | 'INVALID_MEDIA' | 'SEND_FAIL' | 'FLAGGED_WORD'
	) {
		const DATE = new Date();
		const EMBED = createStatusEmbed(StatusEmbedCodes.Error, {
			author: { name: 'Failed to Submit Report' }
		});

		if (type !== 'COOLDOWN') {
			DATE.setSeconds(DATE.getSeconds() + 15);
			this.cooldown[interaction.user.id] = DATE;
		}

		switch (type) {
			case 'COOLDOWN': {
				const TIME = this.cooldown[interaction.user.id];
				EMBED.setDescription(
					`You are currently on cooldown! You can try to submit again in ${Math.floor(
						TIME.getTime() / 1000 - DATE.getTime() / 1000
					)} seconds.`
				);
				break;
			}
			case 'INVALID_USER': {
				EMBED.setDescription(`This user does not exist on Roblox! Please double check your inputs and try again.`);
				break;
			}
			case 'INVALID_VERSION': {
				EMBED.setDescription(
					'The version tag that you provided is not a valid version tag (0.0.0, v0.0.0, v.0.0.0). Please double check your inputs and try again.'
				);
				break;
			}
			case 'INVALID_MEDIA': {
				EMBED.setDescription(
					'You did not provide any valid media links. Please make sure your URL is one of the following: \n- Imgur\n- Youtube\n- Medal\n- Streamable\n- Any URL ending with a media extension'
				);
				break;
			}
			case 'SEND_FAIL': {
				EMBED.setDescription(
					'There was an issue forwarding this message to the developers, so your report has not been submitted. You should try again in a bit.'
				);
				break;
			}
			case 'FLAGGED_WORD': {
				EMBED.setDescription('Forms are not meant for this type of request.');
				break;
			}
			default: {
				EMBED.setDescription('There was an issue submitting your report. If the issue persists, please report it to @luckfire.');
				break;
			}
		}

		return EMBED;
	}

	private resubmitButton(type: string, place: string) {
		return new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder({
				type: ComponentType.Button,
				style: ButtonStyle.Secondary,
				custom_id: `ReportForm.${type}.${place}`,
				label: `Reopen Form`
			})
		);
	}

	private async checkFields(interaction: ModalSubmitInteraction, type: string) {
		const FIELDS = interaction.fields;

		const USEREXISTS = await noblox.getIdFromUsername(FIELDS.getTextInputValue('username')).catch(() => null);
		if (!USEREXISTS) {
			return 'INVALID_USER';
		}

		if (type === 'Issue') {
			const VERSION = /^(v|v\.)?(\d+\.){2}\d+$/.test(FIELDS.getTextInputValue('version'));
			if (!VERSION) return 'INVALID_VERSION';
		}

		const MEDIA = new RegExp(`^https?:\/\/(www\.)?(${this.mediaRegexs.join('|')})$`).test(FIELDS.getTextInputValue('media'));
		if (!MEDIA) {
			return 'INVALID_MEDIA';
		}

		return;
	}

	public override async parse(interaction: ModalSubmitInteraction) {
		if (!interaction.customId.startsWith('ReportForm')) return this.none();

		let [, type, place] = interaction.customId.split('.');

		const CHECKFIELDS = await this.checkFields(interaction, type);
		const ROW = this.resubmitButton(type, place);
		if (this.cooldown[interaction.user.id]?.getTime() > new Date().getTime()) {
			const EMBED = this.submitErrorEmbed(interaction, 'COOLDOWN');

			interaction.reply({
				ephemeral: true,
				embeds: [EMBED],
				components: [ROW]
			});

			this.setComponentsCache(interaction, type);

			return this.none();
		}

		if (CHECKFIELDS) {
			const EMBED = this.submitErrorEmbed(interaction, CHECKFIELDS);

			interaction.reply({
				ephemeral: true,
				embeds: [EMBED],
				components: [ROW]
			});

			this.setComponentsCache(interaction, type);

			return this.none();
		}

		return this.some<InteractionRun>({ type, place });
	}

	public override async run(interaction: ModalSubmitInteraction, options: InteractionRun) {
		let { type, place } = options;

		const REPORTCHANNEL: TextChannel | null = (await this.container.client.channels.fetch(this.reportChannels[place][type], {
			force: true
		})) as TextChannel;

		const REPORT = new EmbedBuilder({
			color: BrandColors.RoyalBlue,
			title: `New ${type} Report`,
			thumbnail: { url: interaction.user.displayAvatarURL({ size: 512 }) || interaction.user.defaultAvatarURL },
			description: `### Discord User\n<@${interaction.user.id}>\n${interaction.fields.fields
				.map((field) => {
					const CUSTOMID =
						field.customId.charAt(0).toUpperCase() +
						field.customId
							.slice(1)
							.replace(/([A-Z])/g, ' $1')
							.trim();
					return `### ${CUSTOMID}\n${field.value || 'N/A'}`;
				})
				.join('\n')}`
		});

		REPORTCHANNEL?.send({
			embeds: [REPORT]
		})
			.then(() => {
				const EMBED = createStatusEmbed(StatusEmbedCodes.Success, {
					author: { name: 'Successfully Submitted Report' },
					description: 'Thank you for submitting a report! Developers will investigate the issue when they are available.'
				});

				this.setComponentsCache(interaction, type, true);

				interaction.reply({
					ephemeral: true,
					embeds: [EMBED]
				});
			})
			.catch((err) => {
				console.log(err);

				this.setComponentsCache(interaction, type);
				const EMBED = this.submitErrorEmbed(interaction, 'SEND_FAIL');

				interaction.reply({
					ephemeral: true,
					embeds: [EMBED]
				});
			});

		interaction;
	}
}

interface InteractionRun {
	type: string;
	place: string;
}
