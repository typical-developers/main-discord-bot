import { ModalSubmitInteraction, MessageFlags, inlineCode, type VoiceBasedChannel } from 'discord.js';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { VoiceRoom } from '#/lib/types/api';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.ModalSubmit
})
export class AdjustVoiceRoomLimitSubmit extends InteractionHandler {
    public override async parse(interaction: ModalSubmitInteraction) {
        if (!interaction.guildId || !interaction.channelId) return this.none();
        if (interaction.customId !== 'voice_room.adjust_limit_submit') return this.none();
        
        await interaction.deferReply({ withResponse: true, flags: [ MessageFlags.Ephemeral ] });

        const room = await this.container.api.guilds.getVoiceRoom(interaction.guildId, interaction.channelId);
        if (room.isErr()) {
            this.container.logger.error(room.error);
            await interaction.editReply({ content: 'Something went wrong, please try again later.' });
            return this.none();
        };
        
        const limit = +interaction.fields.getTextInputValue('user_limit');
        if (isNaN(limit)) return this.none();

        if (limit >= 100) {
            await interaction.editReply({ content: 'The limit cannot be more than 100.' });
            return this.none();
        }

        return this.some({ room: room.value.data, limit });
    }

    public async run(interaction: ModalSubmitInteraction, { room, limit }: { room: VoiceRoom, limit: number }) {
        if (interaction.user.id !== room.current_owner_id) {
            return await interaction.editReply({ content: 'You do not have permission to adjust the limit of this voice room.' });
        }

        if (room.is_locked) {
            return await interaction.editReply({ content: 'This voice room is locked, please unlock it before adjusting the limit.' });
        }

        if (limit <= 1) {
            return await interaction.editReply({ content: 'The limit cannot be less than or equal to 1. If you want to lock the voice room, use the "Toggle Locked" button instead.' });
        }

        /**
         * If settings.user_limit is 0, that means it can be set up to Discord's max (100).
         */
        if (room.settings.user_limit !== 0 && room.settings.user_limit < limit) {
            return await interaction.editReply({ content: `The limit cannot be more than the max limit of ${inlineCode(room.settings.user_limit.toString())}.` });
        }

        try {
            await (interaction.channel as VoiceBasedChannel).setUserLimit(limit);
            return await interaction.editReply({ content: `The limit of the voice room has been set to ${inlineCode(limit.toString())}.` });
        } catch (e) {
            this.container.logger.error(e);
            return await interaction.editReply({ content: 'Something went wrong, please try again later.' });
        }
    }
}