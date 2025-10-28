import { ButtonInteraction, ChannelType, MessageFlags, type VoiceBasedChannel } from 'discord.js';
import { InteractionHandler, InteractionHandlerTypes, } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type VoiceRoom from '#/lib/structures/VoiceRoom';
import type VoiceRoomLobby from '#/lib/structures/VoiceRoomLobby';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button
})
export class CloseVoiceRoom extends InteractionHandler {
    public override async parse(interaction: ButtonInteraction) {
        if (!interaction.guildId || !interaction.channelId)
            return this.none();
        if (interaction.customId !== 'voice_room.close')
            return this.none();
        if (!interaction.channel?.isVoiceBased())
            return this.none();

        await interaction.deferReply({ withResponse: true, flags: [ MessageFlags.Ephemeral ] });

        const settings = await this.container.api.guilds.fetch(interaction.guildId, { createNew: true });
        if (settings.isErr()) {
            await interaction.editReply({ content: 'Something went wrong, please try again later.', });
            return this.none();
        }

        const { activeVoiceRooms } = settings.value;
        const room = await activeVoiceRooms.get(interaction.channelId);
        if (room.isErr()) {
            await interaction.editReply({ content: 'Something went wrong, please try again later.', });
            return this.none();
        }

        const lobby = await room.value.settings();
        if (lobby.isErr()) {
            await interaction.editReply({ content: 'Something went wrong, please try again later.', });
            return this.none();
        }

        return this.some<VoiceRoom>(room.value);
    }

    public async run(interaction: ButtonInteraction, room: VoiceRoom) {
        if (!room.isOwner(interaction.user.id))
            return await interaction.editReply({ content: 'You do not have permission to close this voice room.' });

        const status = await room.delete();
        if (status.isErr()) {
            this.container.logger.error(status.error);
            return await interaction.editReply({ content: 'Something went wrong, please try again later.' });
        }

        try {
            await (interaction.channel as VoiceBasedChannel).delete('Automated Action - Owner manually closed the voice room.');
        } catch (e) {
            this.container.logger.error(e);
            return await interaction.editReply({ content: 'Something went wrong with deleting the channel, contact server admins for it to be removed.' });
        }
    }
}