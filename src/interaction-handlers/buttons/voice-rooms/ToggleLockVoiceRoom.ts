import { InteractionHandler, InteractionHandlerTypes, } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { ButtonInteraction } from 'discord.js';
import { isOwner, voiceRoomInfoEmbed, voiceRoomSettingsFromOrigin } from '#lib/util/voice-rooms';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button
})
export class RenameVoiceRoom extends InteractionHandler {
    public override async parse(interaction: ButtonInteraction) {
        if (!interaction.guildId) return this.none();
        if (interaction.customId !== 'voice_room.toggle_lock') return this.none();

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

        const info = await this.container.api.bot.getVoiceRoom(interaction.guildId, interaction.channelId);
        const channel = interaction.channel;

        if (!info || !channel || !interaction.guildId) return;
        if (!channel.isVoiceBased()) return;

        const updatedInfo = await this.container.api.bot.updateVoiceRoom(interaction.guildId, interaction.channel.id, { is_locked: !info.is_locked });
        if (!updatedInfo) return;

        const settings = await voiceRoomSettingsFromOrigin(interaction.guildId, updatedInfo.origin_channel_id);
        if (!settings) throw new Error('Unable to get settings.');

        updatedInfo.is_locked
            ? await channel.setUserLimit(1)
            // this is so ugly. but it works.
            : await (async () => {
                
                await channel.setUserLimit(settings.user_limit);
            })();

        await interaction.message.edit(voiceRoomInfoEmbed(updatedInfo, settings));
        await interaction.reply({
            content: 'Successfully updated channel state.',
            ephemeral: true
        });
    }
}