import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { type Client, type ActivityOptions, Events, ActivityType } from 'discord.js';

@ApplyOptions<Listener.Options>({
	event: Events.ClientReady,
	once: true
})
export class BotStatus extends Listener {
    private playingCache: { [key: string]: number } = {};
    private activity: ActivityOptions = { type: ActivityType.Watching, name: '' };

    private async fetchTotalPlaying(universeId: number) {
        const response = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`).catch(() => null);

        if (!response || !response.ok) return null;

        const { data } = await response.json();
        const experience  = data[0];

        if (!experience) return null;
        if (this.playingCache[universeId] === experience.playing) return null;

        this.playingCache[universeId] = experience.playing;
        return experience.playing;
    }

    public async statusRun(client: Client) {
        const oaklandsPlaying = await this.fetchTotalPlaying(3666294218);

        if (!oaklandsPlaying) {
            return new Promise((res, _rej) => 
                setTimeout(async () => res(await this.statusRun(client)), 5 * 1000)
            );
        }

        this.activity.name = `Oaklands・${oaklandsPlaying} playing`;
        client.user?.setActivity(this.activity);

        return new Promise((res, _rej) => 
            setTimeout(async () => res(await this.statusRun(client)), 5 * 1000)
        );
    }

    public override async run(client: Client) {
        await this.statusRun(client);
    }
}