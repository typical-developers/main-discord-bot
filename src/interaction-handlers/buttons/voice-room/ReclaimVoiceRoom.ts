import { ButtonInteraction, MessageFlags, type VoiceBasedChannel } from 'discord.js';
import { InteractionHandler, InteractionHandlerTypes, } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { voiceRoomDetailsEmbed } from '#/lib/util/voice-rooms';
import type VoiceRoom from '#/lib/structures/VoiceRoom';
import type VoiceRoomLobby from '#/lib/structures/VoiceRoomLobby';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button
})
export class ReclaimVoiceRoom extends InteractionHandler {
    public override async parse(interaction: ButtonInteraction) {
        if (!interaction.guildId || !interaction.channelId)
            return this.none();
        if (interaction.customId !== 'voice_room.reclaim')
            return this.none();
        if (!interaction.channel?.isVoiceBased())
            return this.none();

        await interaction.deferReply({ withResponse: true, flags: [ MessageFlags.Ephemeral ] });

        const settings = await this.container.api.guilds.fetch(interaction.guildId, { createNew: true });
        if (settings.isErr()) {
            await interaction.reply({ content: 'Something went wrong, please try again later.', });
            return this.none();
        }

        const { activeVoiceRooms } = settings.value;
        const room = await activeVoiceRooms.get(interaction.channelId);
        if (room.isErr())
            return this.none();

        const lobby = await room.value.settings();
        if (lobby.isErr())
            return this.none();

        return this.some<{ room: VoiceRoom, settings: VoiceRoomLobby }>({ room: room.value, settings: lobby.value });
    }

    public async run(interaction: ButtonInteraction, { room, settings }: { room: VoiceRoom, settings: VoiceRoomLobby }) {
        if (!room.isCreator(interaction.user.id))
            return await interaction.editReply({ content: 'You do not have permission to reclaim the ownership of this voice room.' });
        if (room.isOwner(interaction.user.id))
            return await interaction.editReply({ content: 'You already have control over this voice room.' });

        const status = await room.update({ current_owner_id: interaction.user.id });
        if (status.isErr())
            return await interaction.editReply({ content: 'Failed to reclaim the ownership of the voice room, please try again later.' });

        await interaction.message.edit({
            components: [voiceRoomDetailsEmbed(room, settings)],
            flags: [ MessageFlags.IsComponentsV2 ]
        });

        return await interaction.editReply({ content: 'You have reclaimed the ownership of the voice room.' });
    }
}