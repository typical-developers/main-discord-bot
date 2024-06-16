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
            interaction.reply({
                content: 'You are not the owner of this voice room!',
                ephemeral: true
            });

            return this.none();
        };

        return this.some();
    }

    public async run(interaction: ButtonInteraction) {
        const info = await this.container.api.getVoiceRoom(interaction.guildId!, interaction.channelId!);
        const channel = interaction.guild?.channels.cache.get(interaction.channelId!);
        if (!info || !channel || !interaction.guildId) return;
        if (!channel.isVoiceBased()) return; // makes typescript shut up

        const updatedInfo = await this.container.api.updateVoiceRoom(interaction.guildId!, interaction.channelId!, { is_locked: !info.is_locked });
        if (!updatedInfo) return;

        updatedInfo.is_locked
            ? await channel.setUserLimit(1)
            // this is so ugly. but it works.
            : await (async () => {
                const settings = await voiceRoomSettingsFromOrigin(interaction.guildId!, updatedInfo.origin_channel_id);
                if (!settings) throw new Error('Unable to get settings.');
                
                await channel.setUserLimit(settings.user_limit);
            })();

        await interaction.message.edit(voiceRoomInfoEmbed(updatedInfo));
        await interaction.reply({
            content: 'Successfully updated channel state.',
            ephemeral: true
        });
    }
}