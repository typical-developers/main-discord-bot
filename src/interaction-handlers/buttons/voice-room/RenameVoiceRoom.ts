import { ActionRowBuilder, ButtonInteraction, ComponentType, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, type VoiceBasedChannel } from 'discord.js';
import { InteractionHandler, InteractionHandlerTypes, } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button
})
export class RenameVoiceRoom extends InteractionHandler {
    public override async parse(interaction: ButtonInteraction) {
        if (!interaction.guildId || !interaction.channelId) return this.none();
        if (interaction.customId !== 'voice_room.rename') return this.none();

        const room = await this.container.api.guilds.getVoiceRoom(interaction.guildId, interaction.channelId);
        if (room.isErr()) return this.none();

        if (interaction.user.id !== room.value.data.current_owner_id) {
            await interaction.reply({
                content: 'You do not have permission to adjust the limit of this voice room.',
                flags: [ MessageFlags.Ephemeral ]
            })

            return this.none();
        }

        return this.some();
    }

    public async run(interaction: ButtonInteraction) {
        const modal = new ModalBuilder({
            title: 'Rename Voice Room',
            customId: 'voice_room.rename_submit',
            components: [
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder({
                        type: ComponentType.TextInput,
                        customId: 'channel_name',
                        label: 'New Channel Name',
                        value: (interaction.channel as VoiceBasedChannel).name,
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