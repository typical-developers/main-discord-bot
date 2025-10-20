import { ActionRowBuilder, ButtonInteraction, ComponentType, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { InteractionHandler, InteractionHandlerTypes, } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button
})
export class AdjustVoiceRoomLimit extends InteractionHandler {
    public override async parse(interaction: ButtonInteraction) {
        if (!interaction.guildId || !interaction.channelId) return this.none();
        if (interaction.customId !== 'voice_room.adjust_limit') return this.none();

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
            title: 'Adjust Voice Room Limit',
            customId: 'voice_room.adjust_limit_submit',
            components: [new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder({
                    type: ComponentType.TextInput,
                    customId: 'user_limit',
                    label: 'User Limit',
                    style: TextInputStyle.Short,
                    placeholder: 'More than one, greater or equal to the original limit.',
                    maxLength: 4,
                    required: true
                })
            )]
        });

        return await interaction.showModal(modal);
    }
}