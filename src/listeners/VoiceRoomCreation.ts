import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { ChannelType, Events, type VoiceBasedChannel, VoiceState, MessageFlags } from 'discord.js';
import { voiceRoomDetailsEmbed } from '#/lib/util/voice-rooms';

@ApplyOptions<Listener.Options>({
    event: Events.VoiceStateUpdate,
    once: false
})
export class VoiceRoomCreation extends Listener {
    private _creationCooldown: Array<string> = [];

    private _setCreationCooldown(memberId: string) {
        this._creationCooldown.push(memberId);

        setTimeout(() => {
            this._creationCooldown.splice(this._creationCooldown.indexOf(memberId), 1);
        }, 30 * 1_000);
    }

    private async _notifyFailedCreation(channel: VoiceBasedChannel, memberId: string) {
        return await channel.send({ content: `<@${memberId}> failed to create a voice room. Please try again later.`, });
    }

    public override async run(_: VoiceState, current: VoiceState) {
        if (!current.member) return;
        if (!current.channel) {
            return;
        }

        const settings = await this.container.api.guilds.getGuildSettings(current.guild.id);
        if (settings.isErr()) return;

        const { voice_room_lobbies } = settings.value.data;
        const lobby = voice_room_lobbies.find((l) => l.channel_id === current.channel!.id);
        if (!lobby) return;

        if (this._creationCooldown.includes(current.member.id)) {
            await current.channel.send({ content: `<@${current.member.id}> you are on a cooldown, please try again in a bit.` })
            await current.member.voice.disconnect();
            return;
        };

        try {
            const room = await current.guild.channels.create({
                type: ChannelType.GuildVoice,
                parent: current.channel.parentId,
                name: `${current.member.displayName}\'s Voice Room`,
                userLimit: lobby.user_limit,
            });

            const registeredRoom = await this.container.api.guilds.registerVoiceRoom(current.guild.id, lobby.channel_id, {
                channel_id: room.id,
                creator_id: current.member.id
            });
            if (registeredRoom.isErr()) {
                this.container.logger.error(registeredRoom.error);

                await room.delete();
                await this._notifyFailedCreation(current.channel, current.member.id);
                await current.member.voice.disconnect();

                return;
            }

            this._setCreationCooldown(current.member.id);
            await current.member.voice.setChannel(room);

            await room.send({
                components: [voiceRoomDetailsEmbed(registeredRoom.value.data)],
                flags: [ MessageFlags.IsComponentsV2 ]
            })
        } catch (e) {
            this.container.logger.error(e);
            await this._notifyFailedCreation(current.channel, current.member.id);
            await current.member.voice.disconnect();
        }
    }
}
