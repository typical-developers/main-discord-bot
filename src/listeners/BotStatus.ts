import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { type Client, type ActivityOptions, Events, ActivityType } from 'discord.js';
import { BotStatusCycle, ExperienceUniverseID } from '#lib/types/enums';

@ApplyOptions<Listener.Options>({
	event: Events.ClientReady,
	once: true
})
export class BotStatus extends Listener {
    private activity: ActivityOptions = { type: ActivityType.Watching, name: '' };
    private playingCache: { [key: string]: number } = {};
    private currentStatus: BotStatusCycle = BotStatusCycle.OaklandsPlaying;

    private async recachePlayers(universeIds: number[]) {
        const response = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeIds.join(',')}`).catch(() => null);

        if (!response || !response.ok) return null;

        const { data } = await response.json() as {
            // There's more data to this but this is everything the function needs.
            data: {
                id: number;
                name: string;
                description: string;
                playing: number;
            }[]
        };

        if (!data.length) return null;

        this.playingCache = data.reduce((acc, curr) => ({...acc, [curr.id]: curr.playing}), {});
    }


    public async statusRun(client: Client) {
        await this.recachePlayers([ExperienceUniverseID.Oaklands, ExperienceUniverseID.DisasterDefense]);

        switch (this.currentStatus) {
            case BotStatusCycle.OaklandsPlaying:
                const oaklandsPlayers = this.playingCache[ExperienceUniverseID.Oaklands];
                if (!oaklandsPlayers) break;

                this.currentStatus = BotStatusCycle.DisasterDefensePlayng;
                this.activity.name = `Oaklands・${oaklandsPlayers} playing`;

                break;
            case BotStatusCycle.DisasterDefensePlayng:
                const ddPlayers = this.playingCache[ExperienceUniverseID.DisasterDefense];
                if (!ddPlayers) break;

                this.currentStatus = BotStatusCycle.OaklandsPlaying;
                this.activity.name = `Disaster Defense・${ddPlayers} playing`;

                break;
        }

        if (client.user?.presence.activities[0]?.name !== this.activity.name) {
            client.user?.setActivity(this.activity);
        }

        return new Promise((res) => {
            setTimeout(async () => {
                res(await this.statusRun(client));
            }, 5 * 1000);
        });
    }

    public override async run(client: Client) {
        await this.statusRun(client);
    }
}