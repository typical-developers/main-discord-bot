import { BrandColors, StatusEmbedCodes } from '#lib/types/constants';
import { EmbedBuilder, type APIEmbed } from 'discord.js';

export function createStatusEmbed(code: StatusEmbedCodes, embed: APIEmbed) {
	const EMBED = new EmbedBuilder({
		...embed
	});

	switch (code) {
		case StatusEmbedCodes.Error:
			EMBED.setColor(BrandColors.CarminePink).setAuthor({
				name: embed.author?.name || 'Error',
				iconURL: ''
			});
			break;
		case StatusEmbedCodes.Information:
			EMBED.setColor(BrandColors.Violet).setAuthor({
				name: embed.author?.name || 'Information',
				iconURL: ''
			});
			break;
		case StatusEmbedCodes.Warning:
			EMBED.setColor(BrandColors.Sunrise).setAuthor({
				name: embed.author?.name || 'Warning',
				iconURL: ''
			});
			break;
		case StatusEmbedCodes.Success:
			EMBED.setColor(BrandColors.Spearmint).setAuthor({
				name: embed.author?.name || 'Success',
				iconURL: ''
			});
			break;
	}

	return EMBED;
}
