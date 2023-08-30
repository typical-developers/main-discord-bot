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
			let GIVEROLES: { [key: string]: number } = {};
			let totaledPoints = 0;

			for (let activityRole of GUILDSETTINGS.activity_roles) {
				let [pointsRequired, roleId]: [number, string] = activityRole;
				totaledPoints += pointsRequired;

				if (UPDATEDENTRY.amount >= totaledPoints) {
					const ROLE = await message.guild.roles.fetch(roleId).catch(() => null);

					if (!ROLE) continue;
					if (message.member?.roles.cache.has(roleId)) continue;

					GIVEROLES[roleId] = totaledPoints;
				}
			}

			if (Object.keys(GIVEROLES).length !== 0) {
				message.member?.roles.add(Object.keys(GIVEROLES).map((r) => r)).catch(() => null);
				if (Object.keys(GIVEROLES).length > 1) return;

				message.channel.send({
					content: `<@${message.author.id}> You have reached ${inlineCode(
						Object.values(GIVEROLES)[0].toString()
					)} activity points and have unlocked a new activity role!`
				});
			}
		}
	}
}
