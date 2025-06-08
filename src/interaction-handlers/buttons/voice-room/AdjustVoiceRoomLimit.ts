import { ActionRowBuilder, ButtonInteraction, ComponentType, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { InteractionHandler, InteractionHandlerTypes, } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { isOwner, getVoiceRoom } from '#/lib/util/voice-rooms';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button
})
export class AdjustVoiceRoomLimit extends InteractionHandler {
    public override async parse(interaction: ButtonInteraction) {
        if (interaction.customId !== 'voice_room.adjust_limit') return this.none();

        const settings = await this.container.api.getGuildSettings(interaction.guildId!); 
        if (settings.isErr()) return this.none();

        const voiceRoom = await getVoiceRoom(interaction.guildId!, interaction.channelId!);
        if (voiceRoom.isErr()) return this.none();

        if (!isOwner(interaction.user.id, voiceRoom.value.room)) {
            await interaction.reply({
                content: 'You are not the owner of this voice room.',
                flags: [ MessageFlags.Ephemeral ],
            });

            return this.none();
        }

        return this.some();
    }

    public async run(interaction: ButtonInteraction) {
        const modal = new ModalBuilder({
            title: 'Adjust Voice Room Limit',
            customId: 'voice_room.adjust_limit_submit',
            components: [
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder({
                        type: ComponentType.TextInput,
                        customId: 'user_limit',
                        label: 'User Limit',
                        style: TextInputStyle.Short,
                        placeholder: 'More than one, greater or equal to the original limit.',
                        maxLength: 4,
                        required: true
                    })
                )
            ]
        });

        return interaction.showModal(modal);
    }
}