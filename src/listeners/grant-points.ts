import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { ChannelType, Events, Message, inlineCode } from 'discord.js';
import { getGuildSettings, getUserPoints, updateUserPoints } from '#lib/util/database';

@ApplyOptions<Listener.Options>({
	event: Events.MessageCreate,
	once: false
})
export class PointsGrant extends Listener {
	readonly cooldown = 15;
	readonly amount = 2;

	public override async run(message: Message) {
		if (message.author.bot || message.channel.type === ChannelType.DM) return;
		if (!message.guild) return;

		const GUILDSETTINGS = await getGuildSettings(message.guild.id);
		if (!GUILDSETTINGS || !GUILDSETTINGS.points_system) return;

		const USERPOINTS = await getUserPoints(message.author.id, message.guild.id);
		if (!USERPOINTS) return;

		const RANTIME = Math.floor(new Date().getTime() / 1000);
		if (USERPOINTS.last_ran + this.cooldown > RANTIME) return;

		const UPDATEDENTRY = await updateUserPoints(message.author.id, message.guild.id, {
			amount: USERPOINTS.amount + this.amount,
			last_ran: RANTIME + this.cooldown
		});
		if (!UPDATEDENTRY) return;

		if (GUILDSETTINGS.activity_roles) {
			const GIVEROLES = [];
			const MEMBER = await message.member?.fetch().catch(() => null);
			if (!MEMBER) return;

			let totaledPoints = 0;
			for (let activityRole of GUILDSETTINGS.activity_roles) {
				let [pointsRequired, roleId] = activityRole;
				totaledPoints += pointsRequired;

				if (UPDATEDENTRY.amount >= totaledPoints) {
					const ROLE = await message.guild.roles.fetch(roleId).catch(() => null);

					if (!ROLE) continue;
					if (MEMBER.roles.cache.has(roleId)) continue;

					GIVEROLES.push(roleId);
				} else {
					totaledPoints -= pointsRequired;
					break;
				}
			}

			if (GIVEROLES.length > 0) {
				await MEMBER.roles.add(GIVEROLES);
			} else return;

			if (GIVEROLES.length === 1) {
				await message.channel.send({
					content: `<@${message.author.id}> You have reached ${inlineCode(
						totaledPoints.toString()
					)} activiy points and have unlocked a new role!`
				});
			}
		}
	}
}
