import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, GuildMember } from 'discord.js';

@ApplyOptions<Listener.Options>({
	event: Events.GuildMemberAdd,
	once: false
})
export class BanCheckListener extends Listener {
	public override async run(member: GuildMember) {
		if (member.guild.id !== '893717531179769887') return;

		const BANNED = (await this.container.client.guilds.fetch('865737627712749579')).bans.fetch(member.id).catch(() => null);
		if (!BANNED) return;

		member.roles.add('1132539246276784208');
	}
}
