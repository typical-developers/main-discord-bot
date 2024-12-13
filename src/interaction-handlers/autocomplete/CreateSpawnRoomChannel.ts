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

    public async run(interaction: AutocompleteInteraction) {
        if (!interaction.guild) {
            return await interaction.respond([{
                name: 'No channels found!',
                value: ""
            }]);
        }

        const settings = await this.container.api.getGuildSettings(interaction.guild.id);
        const voiceChannels = (await interaction.guild.channels.fetch()).toJSON()
            .filter((c) => c !== null)
            .filter((c) => c!.type === ChannelType.GuildVoice)
            .filter((c) => {
                const spawnRoom = settings.spawn_rooms.find(({ channel_id }) => channel_id === c!.id);
                return !spawnRoom;
            })
            .filter((c) => c!.parent !== null)
            .slice(0, 24) as VoiceChannel[];

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