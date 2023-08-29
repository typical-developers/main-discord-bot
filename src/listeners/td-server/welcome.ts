import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, GuildMember, TextChannel } from 'discord.js';

@ApplyOptions<Listener.Options>({
	event: Events.GuildMemberAdd,
	once: false
})
export default class WelcomeListener extends Listener {
	public override async run(member: GuildMember) {
		if (member.guild.id !== '1070801077680754788') return;

		const CHANNEL = (await member.guild.channels.fetch('1070858115882434580').catch(() => null)) as TextChannel;
		if (!CHANNEL) return;

		return CHANNEL.send({
			content: `Alright, <@${member.id}>, now I'm not mad but.. why? You know what you did to end up here.\n\nNow ask yourself.. was it *really* worth it to exploit in a lego game? Go on, I'll wait for your answer. Chances are you said "yes," or "I don't care about your silly legos," and to that I say... damn.\n\nL bozo.`
		});
	}
}
