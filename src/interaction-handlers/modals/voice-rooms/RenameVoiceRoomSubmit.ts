import { InteractionHandler, InteractionHandlerTypes, } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { ModalSubmitInteraction, inlineCode } from 'discord.js';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.ModalSubmit
})
export class RenameVoiceRoom extends InteractionHandler {
    public override async parse(interaction: ModalSubmitInteraction) {
        if (!interaction.guildId || !interaction.channelId) return this.none();
        if (interaction.customId !== 'voice_room.rename_submit') return this.none();

        const name = interaction.fields.getTextInputValue('channel_name');

        return this.some(name);
    }

    public async run(interaction: ModalSubmitInteraction, name: string) {
        const info = await this.container.api.getVoiceRoom(interaction.guildId!, interaction.channelId!);
        const channel = interaction.guild?.channels.cache.get(interaction.channelId!);
        if (!info || !channel) return;

        await interaction.deferReply({ ephemeral: true, fetchReply: true });
        await interaction.editReply({ content: 'Updating channel name. If you are constantly renaming the channel, this may take a bit longer.' });

        await channel.setName(name);

        interaction.editReply({ content: `Renamed voice room to ${inlineCode(name)}.` });
    }
}