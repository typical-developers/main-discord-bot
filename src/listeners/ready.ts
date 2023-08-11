import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, Client } from 'discord.js';

@ApplyOptions<Listener.Options>({
	event: Events.ClientReady,
	once: true
})
export class ReadyListener extends Listener {
	public override async run(client: Client) {
		if (!client) return;
		if (!client.user) return;

		// this.container.supabase.channel('table_db_changes')
		// .on(
		// 	'postgres_changes',
		// 	{
		// 		event: 'UPDATE',
		// 		schema: 'public',
		// 		table: 'points'
		// 	},
		// 	(payload: any) => {
		// 		console.log(payload);
		// 	}
		// )
		// .subscribe();

		// client.user?.setActivity({
		// 	type: ActivityType.Competing,
		// 	name: 'being the worst bot ever made.'
		// });
	}
}
