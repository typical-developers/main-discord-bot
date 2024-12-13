import { InteractionHandler, InteractionHandlerTypes, } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { ButtonInteraction } from 'discord.js';
import { isOwner, voiceRoomInfoEmbed, voiceRoomSettingsFromOrigin } from '@/lib/util/voice-rooms';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button
})
export class RenameVoiceRoom extends InteractionHandler {
    public override async parse(interaction: ButtonInteraction) {
        if (!interaction.guildId) return this.none();
        if (interaction.customId !== 'voice_room.close') return this.none();

        if (!(await isOwner(interaction.guildId, interaction.channelId, interaction.user.id))) {
            await interaction.reply({
                content: 'You are not the owner of this voice room!',
                ephemeral: true
            });

            return this.none();
        };

        return this.some();
    }

    public async run(interaction: ButtonInteraction) {
        if (!interaction.guildId || !interaction.channelId) return;

        const room = await this.container.api.getVoiceRoom(interaction.guildId, interaction.channelId);
        const channel = interaction.channel;

        if (!room || !channel) return;
        if (!channel.isVoiceBased()) return;

        for (const [_, member] of channel.members) {
            await member.voice.setChannel(null);
        }
    }
}