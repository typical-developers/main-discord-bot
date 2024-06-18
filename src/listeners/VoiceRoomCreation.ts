import { VoiceRoomSettingsDetails } from '@typical-developers/api-types/graphql';
import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { ChannelType, Events, VoiceBasedChannel, VoiceState } from 'discord.js';
import { voiceRoomInfoEmbed } from '#lib/util/voice-rooms';

@ApplyOptions<Listener.Options>({
    event: Events.VoiceStateUpdate,
    once: false
})
export class VoiceRoomCreation extends Listener {
    public cooldown: string[] = [];
    public api = this.container.api;

    private async createNewVoiceRoom(state: VoiceState, settings: VoiceRoomSettingsDetails) {
        if (this.cooldown.includes(state.member!.id)) {
            state.channel?.send(`<@${state.member!.id}> you're creating voice rooms too quickly!`).catch(() => null);
            return await state.member?.voice.disconnect();
        }

        this.cooldown.push(state.member!.id);

        const room = await state.guild.channels.create({
            type: ChannelType.GuildVoice,
            parent: state.channel?.parent,
            name: `@${state.member?.user.displayName}\'s Channel`,
            userLimit: settings.user_limit
        });

        const data = await this.api.createVoiceRoom(state.guild.id, settings.voice_channel_id, room.id, state.member!.id).catch(() => null);
        if (!data) {
            await room.delete().catch(() => null);
            await state.member?.voice.disconnect().catch(() => null);
            await state.channel?.send({
                content: `<@${state.member!.id}> there was an issue creating your channel. This has been forwarded to the developers.`
            }).catch(() => null);
        };

        await state.member!.voice.setChannel(room);
        await room.send(voiceRoomInfoEmbed(data!)); // fix this type later.

        setTimeout(() => {
            const index = this.cooldown.findIndex((id) => id === state.member!.id);
            this.cooldown.splice(index, 1);
        }, 1000 * 15);
    }

    private async removeOldVoiceRoom(channel: VoiceBasedChannel) {
        if (!channel.deletable) return;

        const isDeleted = await channel.delete();
        if (!isDeleted) return;

        await this.api.deleteVoiceRoom(channel.guildId, channel.id);
    }

    private async transferOwnership(channel: VoiceBasedChannel, userId: string) {
        const settings = await this.api.updateVoiceRoom(channel.guild.id, channel.id, { current_owner_id: userId });
        
        if (settings) {
            return channel.send({ content: `The new owner of this voice chat is <@${userId}>` }).catch(() => null);
        }
    }

    public override async run(previous: VoiceState, current: VoiceState) {
        if (!current.member) return;
        if (!previous.guild.id && !current.guild.id) return;

        const settings = await this.api.getGuildSettings(current.guild.id);
        if (!settings.voice_rooms.length) return;

        const { voice_rooms } = settings;
        const ids = voice_rooms.map((v) => v.voice_channel_id);

        if (current.channelId !== null) {
            if (ids.includes(current.channelId)) {
                const settings = voice_rooms.find(({ voice_channel_id }) => voice_channel_id === current.channelId);
                if (!settings) return;

                await this.createNewVoiceRoom(current, settings);
            }
            else {
                const info = await this.api.getVoiceRoom(current.guild.id, current.channelId);
                if (!info) return;

                // if (info.is_locked) {
                //     return await current.member.voice.disconnect();
                // }
            }
        }
        
        if (previous.channelId !== null) {
            const info = await this.api.getVoiceRoom(previous.guild.id, previous.channelId);
            if (!info) return;

            const memberIds = previous.channel?.members.map(({ id }) => id) || [];
            if (previous.channel && !memberIds?.length) {
                await this.removeOldVoiceRoom(previous.channel);
            }

            if (previous.channel && memberIds?.length || 0 >= 1) {
                if (memberIds.includes(info.current_owner_id)) return;

                const firstMemberId = memberIds[0];
                await this.transferOwnership(previous.channel!, firstMemberId);
            }
        }
    }
}
