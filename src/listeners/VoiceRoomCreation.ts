import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, ChannelType, type VoiceState, type VoiceBasedChannel } from 'discord.js';
import { voiceRoomInfoEmbed } from '@/lib/util/voice-rooms';
import type { GuildSettings } from '@/lib/types/api';

@ApplyOptions<Listener.Options>({
    event: Events.VoiceStateUpdate,
    once: false
})
export class VoiceRoomCreation extends Listener {
    public _cooldown: string[] = [];

    private _cooldownPush(userId: string) {
        this._cooldown.push(userId);

        setTimeout(() => {
            const index = this._cooldown.findIndex((id) => id === userId);
            this._cooldown.splice(index, 1);
        }, 1000 * 15);
    }

    public async createVoiceRoom(state: VoiceState, options: GuildSettings['spawn_rooms'][any]) {
        const room = await state.guild.channels.create({
            type: ChannelType.GuildVoice,
            parent: state.channel?.parent,
            name: `@${state.member!.displayName}\'s Room`,
            userLimit: options.user_limit
        });

        try {
            if (!room) {
                return await state.member!.voice.disconnect();
            }

            const info = await this.container.api.createVoiceRoom(
                state.guild.id, options.channel_id,
                {
                    ownerId: state.member!.id,
                    roomId: room.id
                });
            
            if (!info) {
                await room.delete();
                await state.member!.voice.disconnect();
                return;
            }

            this._cooldownPush(state.member!.id);
            await state.member!.voice.setChannel(room);
            await room.send(voiceRoomInfoEmbed(info, options));
        }
        catch (e) {
            await state.member!.voice.disconnect();
        }
    }

    public async deleteVoiceRoom(channel: VoiceBasedChannel) {
        if (!channel.deletable) return;

        await channel.delete().catch(() => ({}));
        await this.container.api.deleteVoiceRoom(channel.guildId, channel.id);
    }

    public async transferOwnership(guildId: string, roomId: string, ownerId: string) {
        return await this.container.api.updateVoiceRoom(guildId, roomId, {
            transferOwner: ownerId
        });
    }

    public override async run(previous: VoiceState, current: VoiceState) {
        if (!current.member) return;
        if (!previous.guild.id && !current.guild.id) return;

        if (previous.channel === null && current.channel == null) return;

        // We check this condition first in the event a spawn remove is removed.
        if (previous.channel) {
            const info = await this.container.api.getVoiceRoom(previous.guild.id, previous.channel.id);
            if (!info) return;
            
            const connected = previous.channel.members.map(({ id }) => id);
            if (connected.includes(info.current_owner_id)) return;

            if (!connected.length) {
                return await this.deleteVoiceRoom(previous.channel);
            }
            else {
                const newOwner = connected[0];
                return await this.transferOwnership(previous.guild.id, previous.channel.id, newOwner); 
            }
        }

        const settings = await this.container.api.getGuildSettings(current.guild.id);
        if (!settings.spawn_rooms.length) return;

        const { spawn_rooms } = settings;
        const originChannels = spawn_rooms.map(({ channel_id }) => channel_id);

        if (current.channelId && originChannels.includes(current.channelId)) {
            if (this._cooldown.includes(current.member.id)) {
                return await current.member.voice.disconnect();
            }

            const options = spawn_rooms.find(({ channel_id }) => channel_id === current.channelId)!;
            return await this.createVoiceRoom(current, options);
        }
    }
}
