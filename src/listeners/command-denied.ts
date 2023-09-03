import { StatusEmbedCodes } from '#lib/types/constants';
import { createStatusEmbed } from '#lib/util/embeds';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener, type ChatInputCommandDeniedPayload, type UserError } from '@sapphire/framework';

@ApplyOptions<Listener.Options>({
	event: Events.ChatInputCommandDenied,
	once: false
})
export class CommandDeniedListener extends Listener {
	public run(error: UserError, { interaction }: ChatInputCommandDeniedPayload) {
		const EMBED = createStatusEmbed(StatusEmbedCodes.Error, {
			author: { name: 'Unauthorized' },
			description: error.message
		});

		return interaction.reply({
			ephemeral: true,
			embeds: [EMBED]
		});
	}
}
