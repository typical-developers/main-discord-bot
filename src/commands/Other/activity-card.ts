import { Command, type ChatInputCommand } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import {
	type ApplicationCommandOptionData,
	ApplicationCommandOptionType,
	ContextMenuCommandInteraction,
	GuildMember,
	AttachmentBuilder,
	ApplicationCommandType
} from 'discord.js';
import { getGuildSettings, getUserPoints } from '#lib/util/database';
import ActivityCard from '#lib/htmltoimage/TypicalCard/ActivityCard';

@ApplyOptions<ChatInputCommand.Options>({
	description: 'Fetch an activity card.'
})
export class ActivtyCardCommand extends Command {
	readonly commandOptions: ApplicationCommandOptionData[] = [
		{
			type: ApplicationCommandOptionType.User,
			name: 'member',
			description: "The member you'd like fetch an activity card for.",
			required: false
		}
	];

	public override registerApplicationCommands(registry: ChatInputCommand.Registry) {
		registry
			.registerChatInputCommand({
				name: this.name,
				description: this.description,
				options: this.commandOptions,
				dmPermission: false
			})
			.registerContextMenuCommand({
				name: 'Get Activity Card',
				type: ApplicationCommandType.User
			});
	}

	private async getRank(serverId: string, userId: string, range: number = 0): Promise<any> {
		const USERPOINTS = await getUserPoints(userId, serverId);
		if (!USERPOINTS) return 0;

		let { data, error } = await this.container.database.client
			.from('points')
			.select('*')
			.eq('server_id', serverId)
			.order('amount', { ascending: false })
			.range(range, range + 2500);

		if (error) return 0;

		const INDEX = data?.findIndex(({ user_id }) => user_id === userId);
		if (INDEX === undefined || INDEX === -1) {
			return await this.getRank(serverId, userId, range + 2500);
		}

		return INDEX + range + 1;
	}

	private async activityCard(interaction: ChatInputCommand.Interaction | ContextMenuCommandInteraction, member: GuildMember) {
		if (!interaction.guild) return;

		const GUILDSETTINGS = await getGuildSettings(interaction.guild.id);
		if (!GUILDSETTINGS?.points_system) {
			return interaction.reply({
				ephemeral: true,
				content: 'Activity system is not enabled for this guild.'
			});
		}

		const USERPOINTS = await getUserPoints(member.id, interaction.guild.id);
		if (!USERPOINTS) return;

		await interaction.deferReply({ fetchReply: true });

		const PROGRESS = {
			title: '',
			points: {
				previous: 0,
				next: 0
			}
		};
		for (let [points, roleId] of GUILDSETTINGS.activity_roles) {
			PROGRESS.points.next += points;

			if (USERPOINTS.amount >= PROGRESS.points.next) {
				const ROLE = await interaction.guild.roles.fetch(roleId);
				if (!ROLE) return;

				PROGRESS.title = ROLE.name;

				continue;
			}

			if (USERPOINTS.amount <= PROGRESS.points.next) {
				PROGRESS.points.previous = PROGRESS.points.next;

				break;
			}
		}

		const ACTIVITYCARD = new ActivityCard(
			{
				name: member.user.globalName || member.user.username,
				avatarURL: member.displayAvatarURL({ forceStatic: true, size: 512 }) || member.user.defaultAvatarURL,
				status: member.presence?.status
			},
			{
				title: PROGRESS.title,
				rank: await this.getRank(interaction.guild.id, member.id),
				points: {
					total: USERPOINTS.amount,
					currentProgress: USERPOINTS.amount - (PROGRESS.points.previous - PROGRESS.points.next),
					nextProgress: PROGRESS.points.next
				}
			}
		).draw();

		const ATTACHMENT = new AttachmentBuilder(await ACTIVITYCARD, { name: 'card.png' });
		return interaction.editReply({
			files: [ATTACHMENT]
		});
	}

	public override async chatInputRun(interaction: ChatInputCommand.Interaction) {
		let member: GuildMember | undefined;

		if (interaction.options.get('member')) {
			member = await interaction.guild?.members.fetch(interaction.options.getUser('member')?.id || '').catch(() => undefined);
		} else {
			member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => undefined);
		}

		if (!member) {
			return interaction.reply({
				ephemeral: true,
				content: `I was unable to fetch this activity card.`
			});
		}

		return this.activityCard(interaction, member);
	}

	public override async contextMenuRun(interaction: ContextMenuCommandInteraction) {
		const MEMBER = await interaction.guild?.members.fetch(interaction.targetId).catch(() => null);
		if (!MEMBER) {
			return interaction.reply({
				ephemeral: true,
				content: `I was unable to fetch <@${interaction.targetId}>\'s activit card.`
			});
		}

		return this.activityCard(interaction, MEMBER);
	}
}
