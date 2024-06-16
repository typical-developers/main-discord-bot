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
            state.channel?.send(`<@${state.member!.id}> you're creating voice rooms too quickly!`);
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
            await room.delete();
            await state.member?.voice.disconnect();
            await state.channel?.send({
                content: `<@${state.member!.id}> there was an issue creating your channel. This has been forwarded to the developers.`
            });
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

    public override async run(previous: VoiceState, current: VoiceState) {
        if (!current.member) return;
        if (!previous.guild.id && !current.guild.id) return;
        if (current.guild.id !== '1230591981579669566') return;

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

                if (info.is_locked) {
                    return await current.member.voice.disconnect();
                }
            }
        }
        
        if (previous.channelId !== null) {
            const info = await this.api.getVoiceRoom(previous.guild.id, previous.channelId);
            if (!info) return;

            if (previous.channel && !previous.channel?.members.size) {
                await this.removeOldVoiceRoom(previous.channel);
            }
        }
    }
}
