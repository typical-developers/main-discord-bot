import { ButtonInteraction, MessageFlags, type VoiceBasedChannel } from 'discord.js';
import { InteractionHandler, InteractionHandlerTypes, } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button
})
export class LockVoiceRoom extends InteractionHandler {
    public override async parse(interaction: ButtonInteraction) {
        return this.some();
    }

    private async _updateLimit(channel: VoiceBasedChannel, limit: number) {
        await channel.setUserLimit(limit);
    }

    public async run(interaction: ButtonInteraction) {
    }
}