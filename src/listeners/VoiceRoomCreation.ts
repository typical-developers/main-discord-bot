import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { ChannelType, Events, type VoiceBasedChannel, VoiceState, MessageFlags } from 'discord.js';
import { voiceRoomInfoCard } from '#/lib/util/voice-rooms';

@ApplyOptions<Listener.Options>({
    event: Events.VoiceStateUpdate,
    once: false
})
export class VoiceRoomCreation extends Listener {
    public override async run(_: VoiceState, current: VoiceState) {
        if (current.channelId === null || current.member === null) return;
        if (current.channel?.type !== ChannelType.GuildVoice) return;

        const settings = await this.container.api.getGuildSettings(current.guild.id);
        if (settings.isErr()) {
            this.container.logger.error(settings.error);
            return;
        }

        const lobbies = settings.value.voice_rooms.map((r) => r.channel_id);
        const lobby = settings.value.voice_rooms.find((l) => l.channel_id === current.channelId);
        if (lobbies.length === 0 || !lobbies.includes(current.channelId)) return;

        const voiceRoom = current.guild.channels.cache.get(current.channelId) as VoiceBasedChannel;
        const categoryId = voiceRoom.parentId;

        try {
            const room = await current.guild.channels.create({
                type: ChannelType.GuildVoice,
                parent: categoryId || null,
                name: `@${current.member.user.username}'s Voice Room`,
                userLimit: lobby!.user_limit,
            });

            const status = await this.container.api.registerGuildVoiceRoom(current.guild.id, current.channelId, {
                room_channel_id: room.id,
                created_by_user_id: current.member.user.id,
                current_owner_id: current.member.user.id
            });
            if (status.isErr()) {
                this.container.logger.error(status.error);

                await room.delete();
                await current.member.voice.setChannel(null);

                await voiceRoom.send({
                    content: `<@${current.member?.user.id}> there was an issue creating a voice room. Try again later.`
                });

                return;
            }

            const { current_rooms, ...settings } = lobby!;
            const infoCard = voiceRoomInfoCard(settings, status.value.data);
            await room.send({
                components: infoCard,
                flags: [ MessageFlags.IsComponentsV2 ]
            });

            await current.member.voice.setChannel(room);
        } catch (e) {
            this.container.logger.error(e);
        }
    }
}
