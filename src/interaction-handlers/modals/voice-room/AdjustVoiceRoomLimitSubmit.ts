import { ModalSubmitInteraction, MessageFlags, inlineCode, type VoiceBasedChannel } from 'discord.js';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { isOwner, getVoiceRoom } from '#/lib/util/voice-rooms';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.ModalSubmit
})
export class AdjustVoiceRoomLimitSubmit extends InteractionHandler {
    public override async parse(interaction: ModalSubmitInteraction) {
        if (!interaction.guildId || !interaction.channelId) return this.none();
        if (!interaction.channel?.isVoiceBased()) return this.none();
        if (interaction.customId !== 'voice_room.adjust_limit_submit') return this.none();

        const limit = interaction.fields.getTextInputValue('user_limit');
        if (isNaN(+limit)) return this.none();
        return this.some(parseInt(limit));
    }

    public async run(interaction: ModalSubmitInteraction, limit: number) {
        const voiceRoom = await getVoiceRoom(interaction.guildId!, interaction.channelId!);
        if (voiceRoom.isErr()) return this.none();

        const { settings, room } = voiceRoom.value;
        const channel = interaction.channel as VoiceBasedChannel;

        /**
         * This could happen if the user somehow leaves the voice before submitting the form.
         */
        if (!isOwner(interaction.user.id, room)) {
            await interaction.reply({
                content: 'You are not the owner of this voice room.',
                flags: [ MessageFlags.Ephemeral ],
            });

            return this.none();
        }

        if (room.is_locked) {
            await interaction.reply({
                content: 'Unable to adjust the limit of a locked voice room. Unlock the voice room first.',
                flags: [ MessageFlags.Ephemeral ],
            });
            return;
        }

        if (limit <= 1) {
            await interaction.reply({
                content: 'The limit cannot be less than or equal to 1. If you want to lock the voice room, use the "Toggle Locked" button instead.',
                flags: [ MessageFlags.Ephemeral ],
            });
            return;
        }

        if (settings.user_limit < limit) {
            await interaction.reply({
                content: `The limit cannot be more than the max limit of ${inlineCode(settings.user_limit.toString())}.`,
                flags: [ MessageFlags.Ephemeral ],
            });
            return;
        }

        await channel.setUserLimit(limit);
        await interaction.reply({
            content: `The limit has been set to ${inlineCode(limit.toString())}.`,
            flags: [ MessageFlags.Ephemeral ],
        });
    }
}