import { InteractionHandler, InteractionHandlerTypes, UserError, } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { ModalSubmitInteraction, inlineCode } from 'discord.js';
import { voiceRoomSettingsFromOrigin } from '#lib/util/voice-rooms';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.ModalSubmit
})
export class RenameVoiceRoom extends InteractionHandler {
    public override async parse(interaction: ModalSubmitInteraction) {
        if (!interaction.guildId || !interaction.channelId) return this.none();
        if (interaction.customId !== 'voice_room.adjust_limit_submit') return this.none();

        const limit = interaction.fields.getTextInputValue('user_limit');
        if (isNaN(+limit)) return this.none();

        return this.some(parseInt(limit));
    }

    public async run(interaction: ModalSubmitInteraction, limit: number) {
        if (!interaction.guildId || !interaction.channelId) return;

        const info = await this.container.api.getVoiceRoom(interaction.guildId, interaction.channelId);
        const channel = interaction.channel;

        if (!info || !channel) return;
        if (!channel.isVoiceBased()) return;

        const originSettings = await voiceRoomSettingsFromOrigin(interaction.guildId, info.origin_channel_id);
        if (!originSettings) return;

        if (info.is_locked) {
            throw new UserError({ identifier: 'CHANNEL_IS_LOCKED', message: 'You cannot change the limit for a room that is locked.' });
        }

        if (limit <= 1) {
            throw new UserError({ identifier: 'LIMIT_TOO_LOW', message: 'You cannot set the limit below 1. If you want to lock the voice room, please use the lock button (if accessible).' });
        }
        
        if (limit > originSettings.user_limit) {
            throw new UserError({ identifier: 'LIMIT_TOO_HIGH', message: `You cannot set the limit past the original limit of ${originSettings.user_limit}` });
        }

        await interaction.deferReply({ ephemeral: true, fetchReply: true });
        await channel.setUserLimit(limit);

        await interaction.editReply({ content: `Updated join limit to ${inlineCode(limit.toString())}.` });
    }
}