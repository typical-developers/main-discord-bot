import { VoiceRoomSettingsDetails } from '@typical-developers/api-types/graphql';
import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { ChannelType, DiscordAPIError, Events, VoiceBasedChannel, VoiceState, type DiscordErrorData } from 'discord.js';
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

        const room = await state.guild.channels.create({
            type: ChannelType.GuildVoice,
            parent: state.channel?.parent,
            name: `@${state.member?.user.username}\'s Channel`,
            userLimit: settings.user_limit
        }).catch(() => null);

        try {
            // The room was not created.
            if (!room) {
                await state.member?.voice.disconnect();
                return;
            }

            const data = await this.api.createVoiceRoom(state.guild.id, settings.voice_channel_id, room.id, state.member!.id);
            if (!data) {
                // The API did not return the data it wanted back.
                await room.delete();
                await state.member?.voice.disconnect();
                return;
            };

            this.cooldown.push(state.member!.id);
            await state.member?.voice.setChannel(room);
            await room.send(voiceRoomInfoEmbed(data, settings));

            setTimeout(() => {
                const index = this.cooldown.findIndex((id) => id === state.member!.id);
                this.cooldown.splice(index, 1);
            }, 1000 * 15);
        }
        catch (e) {
            // just to make sure the remove is removed.
            if (!room) throw e;

            await this.removeOldVoiceRoom(room);
            throw e;
        }
    }

    private async removeOldVoiceRoom(channel: VoiceBasedChannel) {
        if (!channel.deletable) return;

        const isDeleted = await channel.delete().catch((err) => {
            if (err instanceof DiscordAPIError) {
                // this means the channel does not exist to begin with.
                if ((err.rawError as DiscordErrorData).code === 10003) return true;
                
                return false;
            };

            return true;
        });

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

        if (current.channelId !== null && ids.includes(current.channelId)) {
            const settings = voice_rooms.find(({ voice_channel_id }) => voice_channel_id === current.channelId);
            if (!settings) return;

            await this.createNewVoiceRoom(current, settings);
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
