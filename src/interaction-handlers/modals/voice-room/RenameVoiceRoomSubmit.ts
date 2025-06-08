import { ModalSubmitInteraction, MessageFlags, inlineCode, type VoiceBasedChannel } from 'discord.js';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { isOwner, getVoiceRoom } from '#/lib/util/voice-rooms';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.ModalSubmit
})
export class RenameVoiceRoomSubmit extends InteractionHandler {
    public override async parse(interaction: ModalSubmitInteraction) {
        if (!interaction.guildId || !interaction.channelId) return this.none();
        if (!interaction.channel?.isVoiceBased()) return this.none();
        if (interaction.customId !== 'voice_room.rename_submit') return this.none();

        const name = interaction.fields.getTextInputValue('channel_name');
        return this.some(name);
    }

    public async run(interaction: ModalSubmitInteraction, name: string) {
        const voiceRoom = await getVoiceRoom(interaction.guildId!, interaction.channelId!);
        if (voiceRoom.isErr()) return this.none();

        const { room } = voiceRoom.value;
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

        await channel.setName(name);
        await interaction.reply({
            content: `The channel name has been set to ${inlineCode(name)}.`,
            flags: [ MessageFlags.Ephemeral ],
        });
    }
}