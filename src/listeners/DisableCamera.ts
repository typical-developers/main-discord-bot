import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, VoiceState } from 'discord.js';

@ApplyOptions<Listener.Options>({
    event: Events.VoiceStateUpdate,
    once: false
})
export class DisableCamera extends Listener {
    public override async run(_: VoiceState, current: VoiceState) {
        // if (current.guild.id !== '1230591981579669566') return;
        if (current.guild.id !== '865737627712749579') return;

        if (!current.selfVideo) return;
        await current.disconnect('Member enabled self video.');

        if (!current.member) return;
        await current.channel?.send({
            content: `<@${current.member?.id}> we care about our member\'s safety, so enabling your camera is not allowed.`
        });
    }
}
