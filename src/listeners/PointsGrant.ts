import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, Message, inlineCode } from 'discord.js';

@ApplyOptions<Listener.Options>({
    event: Events.MessageCreate,
    once: false
})
export class PointsGrant extends Listener {
    public override async run(message: Message) {
    }
}
