import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, GuildBan } from 'discord.js';

@ApplyOptions<Listener.Options>({
	event: Events.GuildBanAdd,
	once: false
})
export class ReadonlyAddListener extends Listener {
	public override async run(ban: GuildBan) {
		if (ban.guild.id !== '865737627712749579') return;

		const MEMBER = await (await this.container.client.guilds.fetch('893717531179769887')).members.fetch(ban.user.id).catch(() => null);
		if (!MEMBER) return;

		MEMBER.roles.add('1132539246276784208');
	}
}
