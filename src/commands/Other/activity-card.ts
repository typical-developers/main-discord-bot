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
// import { ProfileCard } from '#lib/extensions/ProfileCard';
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
		const USERPOINTS = await getUserPoints(userId, serverId, false);
		if (!USERPOINTS) return 0;

		let { data, error } = await this.container.database.client
			.from('points')
			.select('*')
			.eq('server_id', serverId)
			.order('amount', { ascending: false })
			.range(range, range + 2500);

		if (!data || !data.length || error) return 0;

		const INDEX = data.findIndex(({ user_id }) => user_id === userId);
		if (INDEX === -1) {
			return await this.getRank(serverId, userId, range + 2500);
		}

		return INDEX + range + 1;
	}

	private async activityCard(interaction: ChatInputCommand.Interaction | ContextMenuCommandInteraction, member: GuildMember) {
		if (!interaction.guild) return;
		if (member.user.bot) return;

		const GUILDSETTINGS = await getGuildSettings(interaction.guild.id);
		if (!GUILDSETTINGS?.points_system) {
			return interaction.reply({
				ephemeral: true,
				content: 'Activity system is not enabled for this guild.'
			});
		}

		const USERPOINTS = await getUserPoints(member.id, interaction.guild.id, false);
		if (!USERPOINTS) {
			return interaction.reply({
				ephemeral: true,
				content: 'This user does not have any activity poitns!'
			});
		}

		await interaction.deferReply({ fetchReply: true });

		const PROGRESS = {
			title: '',
			progress: USERPOINTS.amount,
			required: 0,
			totalPoints: 0
		};
		for (let [index, [points, roleId]] of GUILDSETTINGS.activity_roles.entries()) {
			PROGRESS.totalPoints += points;

			// will set their role title if they have more than the totaled amount
			if (PROGRESS.totalPoints <= USERPOINTS.amount) {
				const ROLE = await interaction.guild.roles.fetch(roleId).catch(() => null);

				PROGRESS.title = ROLE?.name || 'Unknown Title';
				continue;
			}

			if (PROGRESS.totalPoints >= USERPOINTS.amount) {
				if (index === 0 && points !== USERPOINTS.amount) {
					PROGRESS.progress = USERPOINTS.amount;
					PROGRESS.required = PROGRESS.totalPoints;
					break;
				}

				if (PROGRESS.required === USERPOINTS.amount - points) {
					let [nextProgress] = GUILDSETTINGS.activity_roles[index + 1] !== undefined ? GUILDSETTINGS.activity_roles[index + 1] : [points];

					PROGRESS.progress = USERPOINTS.amount - (PROGRESS.totalPoints - nextProgress);
					PROGRESS.required = nextProgress;
				} else {
					PROGRESS.progress = USERPOINTS.amount - (PROGRESS.totalPoints - points);
					PROGRESS.required = points;
				}

				break;
			}
		}

		const ACTIVITYCARD = await new ActivityCard(
			{
				name: member.user.username,
				avatarURL: member.displayAvatarURL({ forceStatic: true, size: 512 }) || member.user.defaultAvatarURL,
				status: member.presence?.status
			},
			{
				title: PROGRESS.title, //PROGRESS.title,
				rank: await this.getRank(interaction.guild.id, member.id),
				points: {
					total: USERPOINTS.amount,
					currentProgress: PROGRESS.progress,
					nextProgress: PROGRESS.required
				}
			}
		).draw();
		// const ACTIVITYCARD = await new ProfileCard({
		// 	username: member.user.username,
		// 	displayName: member.user.displayName,
		// 	avatarUrl: member.displayAvatarURL({ forceStatic: true, size: 128 }) || member.user.defaultAvatarURL,
		// 	rank: await this.getRank(interaction.guild.id, member.id),
		// 	tags: PROGRESS.title
		// 		? [{
		// 			name: PROGRESS.title,
		// 			color: '255, 255, 255'
		// 		}]
		// 		: [],
		// 	stats: {
		// 		activityProgression: {
		// 			totalPoints: USERPOINTS.amount,
		// 			currentProgress: PROGRESS.progress,
		// 			requiredProgress: PROGRESS.required
		// 		}
		// 	}
		// }).draw();
		if (!ACTIVITYCARD) return;

		const ATTACHMENT = new AttachmentBuilder(ACTIVITYCARD, { name: 'card.png' });
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
				content: `I was unable to fetch <@${interaction.targetId}>\'s activity card.`
			});
		}

		return this.activityCard(interaction, MEMBER);
	}
}
