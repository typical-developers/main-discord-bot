import { Command, type ChatInputCommand } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { getGuildSettings, getLeaderboard } from '#lib/util/database';
import { EmbedBuilder, inlineCode } from 'discord.js';
import { BrandColors } from '#lib/types/constants';

@ApplyOptions<ChatInputCommand.Options>({
	description: 'Get the activity leaderboard for this guild.'
})
export class EvalCommand extends Command {
	public override registerApplicationCommands(registry: ChatInputCommand.Registry) {
		registry.registerChatInputCommand({
			name: this.name,
			description: this.description
		});
	}

	public override async chatInputRun(interaction: ChatInputCommand.Interaction) {
		if (!interaction.guild) return;

		const GUILDSETTINGS = await getGuildSettings(interaction.guild.id);
		if (!GUILDSETTINGS) return;

		if (!GUILDSETTINGS.points_system) {
			return interaction.reply({
				ephemeral: true,
				content: 'The points system is not enabled for this guild.'
			});
		}

		const LEADERBOARD = await getLeaderboard(interaction.guild.id);
		if (!LEADERBOARD) {
			return interaction.reply({
				ephemeral: true,
				content: 'This guild has no leaderboard data.'
			});
		}

		const EMBED = new EmbedBuilder({
			color: BrandColors.Sunrise,
			author: { name: 'Activity Points Leaderboard' },
			fields: [
				{ name: 'Placement', value: '', inline: true },
				{ name: 'Points', value: '', inline: true }
			]
		}).toJSON();

		for (let [index, user] of LEADERBOARD.entries()) {
			EMBED.fields![0].value += `\n${inlineCode((index + 1).toString())} <@${user.user_id}>`;
			EMBED.fields![1].value += `\n${inlineCode(user.amount.toString())}`;
		}

		return interaction.reply({
			embeds: [EMBED]
		});
	}
}
