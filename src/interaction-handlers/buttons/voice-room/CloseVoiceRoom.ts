import { ButtonInteraction, ChannelType, MessageFlags, type VoiceBasedChannel } from 'discord.js';
import { InteractionHandler, InteractionHandlerTypes, } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { VoiceRoom, VoiceRoomLobby } from '#/lib/util/api';
import { isOwner, getVoiceRoom } from '#/lib/util/voice-rooms';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button
})
export class CloseVoiceRoom extends InteractionHandler {
    public override async parse(interaction: ButtonInteraction) {
        if (interaction.customId !== 'voice_room.close') return this.none();
        if (!interaction.channel?.isVoiceBased()) return this.none();

        const guildSettings = await this.container.api.getGuildSettings(interaction.guildId!); 
        if (guildSettings.isErr()) return this.none();

        const voiceRoom = await getVoiceRoom(interaction.guildId!, interaction.channelId!);
        if (voiceRoom.isErr()) return this.none();

        const { settings, room } = voiceRoom.value;

        if (!isOwner(interaction.user.id, room)) {
            await interaction.reply({
                content: 'You are not the owner of this voice room.',
                flags: [ MessageFlags.Ephemeral ],
            });

            return this.none();
        }

        return this.some({ settings, room });
    }

    public async run(interaction: ButtonInteraction, { room }: { settings: VoiceRoomLobby, room: VoiceRoom }) {
        const channel = interaction.guild?.channels.cache.get(room.room_channel_id);
        if (channel?.type !== ChannelType.GuildVoice) return;
        const status = await this.container.api.deleteGuildVoiceRoom(interaction.guildId!, room.origin_channel_id, room.room_channel_id);
        
        if (status.isErr()) {
            this.container.logger.error(status.error);

            await interaction.reply({
                content: 'Failed to close the voice room. Try again in a bit.',
                flags: [ MessageFlags.Ephemeral ],
            });

            return;
        }
        await channel.delete(`Automated Action - Owner has closed the voice room.`);
    }
}