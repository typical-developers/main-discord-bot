import { ModalSubmitInteraction, MessageFlags, inlineCode, type VoiceBasedChannel } from 'discord.js';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import VoiceRoom from '#/lib/structures/VoiceRoom';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.ModalSubmit
})
export class RenameVoiceRoomSubmit extends InteractionHandler {
    public override async parse(interaction: ModalSubmitInteraction) {
        if (!interaction.guildId || !interaction.channelId) return this.none();
        if (interaction.customId !== 'voice_room.rename_submit') return this.none();

        await interaction.deferReply({ withResponse: true, flags: [ MessageFlags.Ephemeral ] });

        const settings = await this.container.api.guilds.fetch(interaction.guildId, { createNew: true });
        if (settings.isErr()) {
            await interaction.reply({ content: 'Something went wrong, please try again later.', });
            return this.none();
        }

        const { activeVoiceRooms } = settings.value;
        const room = await activeVoiceRooms.get(interaction.channelId);
        if (room.isErr())
            return this.none();

        const name = interaction.fields.getTextInputValue('channel_name');
        if (name.length < 1) {
            await interaction.editReply({ content: 'The name cannot be empty.' });
            return this.none();
        }

        return this.some<{ room: VoiceRoom, name: string }>({ room: room.value, name });
    }

    public async run(interaction: ModalSubmitInteraction, { room, name }: { room: VoiceRoom, name: string }) {
        if (!room.isOwner(interaction.user.id))
            return await interaction.editReply({ content: 'You do not have permission to adjust the limit of this voice room.' });

        try {
            await (interaction.channel as VoiceBasedChannel).setName(name);
            return await interaction.editReply({ content: `The name of the channel has been set to ${inlineCode(name)}.` });
        } catch (e) {
            this.container.logger.error(e);
            return await interaction.editReply({ content: 'Something went wrong, please try again later.' });
        }
    }
}