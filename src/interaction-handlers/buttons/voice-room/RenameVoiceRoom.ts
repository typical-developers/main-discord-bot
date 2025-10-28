import { ActionRowBuilder, ButtonInteraction, ComponentType, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, type VoiceBasedChannel } from 'discord.js';
import { InteractionHandler, InteractionHandlerTypes, } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type VoiceRoom from '#/lib/structures/VoiceRoom';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button
})
export class RenameVoiceRoom extends InteractionHandler {
    public override async parse(interaction: ButtonInteraction) {
        if (!interaction.guildId || !interaction.channelId)
            return this.none();
        if (interaction.customId !== 'voice_room.rename')
            return this.none();
        if (!interaction.channel?.isVoiceBased())
            return this.none();

        const settings = await this.container.api.guilds.fetch(interaction.guildId, { createNew: true });
        if (settings.isErr()) {
            await interaction.reply({ content: 'Something went wrong, please try again later.', });
            return this.none();
        }

        const { activeVoiceRooms } = settings.value;
        const room = await activeVoiceRooms.get(interaction.channelId);
        if (room.isErr())
            return this.none();

        return this.some<VoiceRoom>(room.value);
    }

    public async run(interaction: ButtonInteraction, room: VoiceRoom) {
        if (!room.isOwner(interaction.user.id))
            return await interaction.reply({ content: 'You do not have permission to rename this voice room.' });

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