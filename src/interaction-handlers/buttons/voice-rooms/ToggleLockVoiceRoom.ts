import { InteractionHandler, InteractionHandlerTypes, } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { ButtonInteraction } from 'discord.js';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button
})
export class RenameVoiceRoom extends InteractionHandler {
    public override async parse(interaction: ButtonInteraction) {
        if (!interaction.guildId || !interaction.channelId) return this.none();
        if (interaction.customId !== 'voice_room.toggle_lock') return this.none();

        return this.some();
    }

    public async run(interaction: ButtonInteraction) {
        const info = await this.container.api.getVoiceRoom(interaction.guildId!, interaction.channelId!);
        const channel = interaction.guild?.channels.cache.get(interaction.channelId!);
        if (!info || !channel) return;

        const updatedInfo = await this.container.api.updateVoiceRoom(interaction.guildId!, interaction.channelId!, { is_locked: !info.is_locked });
        if (!updatedInfo) return;

        interaction.editReply({ content: 'Successfully updated channel state.' });
    }
}