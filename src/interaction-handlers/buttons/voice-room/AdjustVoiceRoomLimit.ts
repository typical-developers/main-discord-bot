import { ActionRowBuilder, ButtonInteraction, ComponentType, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { InteractionHandler, InteractionHandlerTypes, } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type VoiceRoom from '#/lib/structures/VoiceRoom';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button
})
export class AdjustVoiceRoomLimit extends InteractionHandler {
    public override async parse(interaction: ButtonInteraction) {
        if (!interaction.guildId || !interaction.channelId)
            return this.none();
        if (interaction.customId !== 'voice_room.adjust_limit')
            return this.none();
        if (!interaction.channel?.isVoiceBased())
            return this.none();

        const settings = await this.container.api.guilds.fetch(interaction.guildId, { createNew: true });
        if (settings.isErr())
            return this.none();

        const { activeVoiceRooms } = settings.value;
        const room = await activeVoiceRooms.get(interaction.channelId);
        if (room.isErr())
            return this.none();

        return this.some<VoiceRoom>(room.value);
    }

    public async run(interaction: ButtonInteraction, room: VoiceRoom) {
        if (!room.isOwner(interaction.user.id))
            return await interaction.reply({
                content: 'You do not have permission to adjust the limit of this voice room.',
            })

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