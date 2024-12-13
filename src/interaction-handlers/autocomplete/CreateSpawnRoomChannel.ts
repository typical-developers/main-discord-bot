import { checkCategoryPermissions } from '@/lib/util/voice-rooms';
import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { ChannelType, VoiceChannel, type AutocompleteInteraction, type GuildBasedChannel } from 'discord.js';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Autocomplete
})
export class ExistingSpawnRoomChannelId extends InteractionHandler {
    public override async parse(interaction: AutocompleteInteraction) {
        if (interaction.options.getSubcommand() !== 'create') {
            return this.none();
        }

        if (interaction.options.getFocused(true).name !== 'channel-id') {
            return this.none();
        }

        return this.some();
    }

    private async _getVoiceChannels(interaction: AutocompleteInteraction) {
        const channels = await interaction.guild!.channels.fetch();
        const afkChannel = interaction.guild!.afkChannel;
        const settings = await this.container.api.getGuildSettings(interaction.guild!.id);
        
        const voiceChannels: VoiceChannel[] = [];

        for (const [_, channel] of channels) {
            if (!channel) continue;

            if (channel.type !== ChannelType.GuildVoice) continue;
            if (channel.parent === null) continue;
            if (channel.id === afkChannel?.id) continue;

            if (settings.spawn_rooms.find(({ channel_id }) => channel_id === channel.id)) continue;

            const clientMember = await interaction.guild!.members.fetch(interaction.client.user.id);
            const hasCategoryPermission = checkCategoryPermissions(channel.parent, clientMember);

            if (!hasCategoryPermission) continue;

            voiceChannels.push(channel);
        }

        return voiceChannels;
    }

    public async run(interaction: AutocompleteInteraction) {
        if (!interaction.guild) {
            return await interaction.respond([{
                name: 'No channels found!',
                value: ""
            }]);
        }

        const voiceChannels = await this._getVoiceChannels(interaction);

        if (!voiceChannels.length) {
            return await interaction.respond([{
                name: 'No channels found!',
                value: ""
            }]);
        }

        return await interaction.respond(voiceChannels.map((c) => ({
            name: `🔊 ${c.name} (${c.id})`,
            value: c.id
        })));
    }
}