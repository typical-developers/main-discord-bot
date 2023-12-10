import { Precondition } from '@sapphire/framework';
import type { ChatInputCommandInteraction } from 'discord.js';

export class StaffOnlyPrecondition extends Precondition {
	readonly owners = [
		'547951620235984906', // Hoofer
		'337440972239798273', // Noval
		'256815446802694144' // Lucas
	];

	private async checkOwner(userId: string) {
		return this.owners.includes(userId) ? this.ok() : this.error({ message: 'Only owners have the permission to run this command.' });
	}

	public override async chatInputRun(interaction: ChatInputCommandInteraction) {
		return this.checkOwner(interaction.user.id);
	}
}
