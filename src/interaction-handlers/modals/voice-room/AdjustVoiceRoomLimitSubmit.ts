import { ModalSubmitInteraction, MessageFlags, inlineCode, type VoiceBasedChannel } from 'discord.js';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type VoiceRoom from '#/lib/structures/VoiceRoom';
import type VoiceRoomLobby from '#/lib/structures/VoiceRoomLobby';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.ModalSubmit
})
export class AdjustVoiceRoomLimitSubmit extends InteractionHandler {
    public override async parse(interaction: ModalSubmitInteraction) {
        if (!interaction.guildId || !interaction.channelId)
            return this.none();
        if (interaction.customId !== 'voice_room.adjust_limit_submit')
            return this.none();
        
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

        const lobby = await room.value.settings();
        if (lobby.isErr())
            return this.none();

        const limit = +interaction.fields.getTextInputValue('user_limit');
        if (isNaN(limit)) return this.none();

        return this.some<{ room: VoiceRoom, settings: VoiceRoomLobby, limit: number }>({ room: room.value, settings: lobby.value, limit });
    }

    public async run(interaction: ModalSubmitInteraction, { room, settings, limit }: { room: VoiceRoom, settings: VoiceRoomLobby, limit: number }) {
        if (!room.isOwner(interaction.user.id))
            return await interaction.editReply({
                content: 'You do not have permission to adjust the limit of this voice room.'
            });
        if (room.isLocked)
            return await interaction.editReply({
                content: 'This voice room is locked, please unlock it before adjusting the limit.'
            });
        if (limit <= 1)
            return await interaction.editReply({
                content: 'The limit cannot be less than or equal to 1. If you want to lock the voice room, use the "Toggle Locked" button instead.'
            });

        /**
         * If settings.userLimit is 0, that means there is no limit (outside of Discord's limit of 99).
         */
        if (settings.userLimit === 0 && limit > 99 || settings.userLimit !== 0 && limit > settings.userLimit)
            return await interaction.editReply({
                content: `The limit cannot be more than the max limit of ${inlineCode((settings.userLimit || '99').toString())}.`
            });

        try {
            await (interaction.channel as VoiceBasedChannel).setUserLimit(limit);
            return await interaction.editReply({ content: `The limit of the voice room has been set to ${inlineCode(limit.toString())}.` });
        } catch (e) {
            this.container.logger.error(e);
            return await interaction.editReply({ content: 'Something went wrong, please try again later.' });
        }
    }
}