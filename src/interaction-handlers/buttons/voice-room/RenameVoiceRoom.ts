import { ActionRowBuilder, ButtonInteraction, ComponentType, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { InteractionHandler, InteractionHandlerTypes, } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { getVoiceRoom, isOwner } from '#/lib/util/voice-rooms';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button
})
export class RenameVoiceRoom extends InteractionHandler {
    public override async parse(interaction: ButtonInteraction) {
        if (interaction.customId !== 'voice_room.rename') return this.none();
        if (!interaction.channel?.isVoiceBased()) return this.none();

        const settings = await this.container.api.getGuildSettings(interaction.guildId!); 
        if (settings.isErr()) return this.none();

        const voiceRoom = await getVoiceRoom(interaction.guildId!, interaction.channelId!);
        if (voiceRoom.isErr()) return this.none();

        const { room } = voiceRoom.value;

        if (!isOwner(interaction.user.id, room)) {
            await interaction.reply({
                content: 'You are not the owner of this voice room.',
                flags: [ MessageFlags.Ephemeral ],
            });

            return this.none();
        }

        return this.some();
    }

    public async run(interaction: ButtonInteraction,) {
        const modal = new ModalBuilder({
            title: 'Rename Voice Room',
            customId: 'voice_room.rename_submit',
            components: [
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder({
                        type: ComponentType.TextInput,
                        customId: 'channel_name',
                        label: 'New Channel Name',
                        style: TextInputStyle.Short,
                        maxLength: 50,
                        required: true
                    })
                )
            ]
        });

        return interaction.showModal(modal);
    }
}