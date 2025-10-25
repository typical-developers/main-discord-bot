import { ButtonInteraction, ChannelType, MessageFlags, type VoiceBasedChannel } from 'discord.js';
import { InteractionHandler, InteractionHandlerTypes, } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { VoiceRoom } from '#/lib/types/api';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button
})
export class CloseVoiceRoom extends InteractionHandler {
    public override async parse(interaction: ButtonInteraction) {
        if (!interaction.guildId || !interaction.channelId) return this.none();
        if (interaction.customId !== 'voice_room.close') return this.none();
        if (!interaction.channel?.isVoiceBased()) return this.none();

        await interaction.deferReply({ withResponse: true, flags: [ MessageFlags.Ephemeral ] });

        const room = await this.container.api.guilds.getVoiceRoom(interaction.guildId, interaction.channelId);
        if (room.isErr()) {
            await interaction.reply({ content: 'Something went wrong, please try again later.', });
            return this.none();
        }

        return this.some({ room: room.value.data });
    }

    public async run(interaction: ButtonInteraction, { room }: { room: VoiceRoom }) {
        if (interaction.user.id !== room.current_owner_id) {
            return await interaction.editReply({ content: 'You do not have permission to close this voice room.' });
        }

        const status = await this.container.api.guilds.deleteVoiceRoom(interaction.guildId!, interaction.channelId);
        if (status.isErr()) {
            this.container.logger.error(status.error);
            return await interaction.editReply({ content: 'Something went wrong, please try again later.' });
        }

        try {
            await (interaction.channel as VoiceBasedChannel).delete('Automated Action - No users in voice room.');
        } catch (e) {
            this.container.logger.error(e);
            return await interaction.editReply({ content: 'Something went wrong with deleting the channel, contact server admins for it to be removed.' });
        }
    }
}