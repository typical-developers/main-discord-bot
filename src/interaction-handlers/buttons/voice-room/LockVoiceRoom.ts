import { ButtonInteraction, MessageFlags, type VoiceBasedChannel } from 'discord.js';
import { InteractionHandler, InteractionHandlerTypes, } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { VoiceRoom } from '#/lib/types/api';
import { voiceRoomDetailsEmbed } from '#/lib/util/voice-rooms';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button
})
export class LockVoiceRoom extends InteractionHandler {
    public override async parse(interaction: ButtonInteraction) {
        if (!interaction.guildId || !interaction.channelId) return this.none();
        if (interaction.customId !== 'voice_room.toggle_lock') return this.none();
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
            return await interaction.editReply({ content: 'You do not have permission to lock this voice room.' });
        }

        const isLocked = !room.is_locked;
        const status = await this.container.api.guilds.updateVoiceRoom(interaction.guildId!, interaction.channelId, {
            is_locked: isLocked
        });
        if (status.isErr()) {
            return await interaction.editReply({ content: 'Failed to lock the voice room, please try again later.' });
        };

        isLocked
            ? await (interaction.channel as VoiceBasedChannel).setUserLimit(1)
            : await (interaction.channel as VoiceBasedChannel).setUserLimit(room.settings.user_limit);

        await interaction.message.edit({
            components: [voiceRoomDetailsEmbed(room)],
            flags: [ MessageFlags.IsComponentsV2 ]
        });

        return await interaction.editReply({ content: `The voice room has been ${isLocked ? 'locked' : 'unlocked'}.` });
    }
}