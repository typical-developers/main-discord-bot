import { AutocompleteInteraction, ChannelType, PermissionFlagsBits } from "discord.js";
import { InteractionHandler, InteractionHandlerTypes } from "@sapphire/framework";
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Autocomplete,
})
export class VoiceRoomLobbyChannel extends InteractionHandler {
    public override async parse(interaction: AutocompleteInteraction) {
        const focused = interaction.options.getFocused(true);

        if (focused.name !== 'channel') return this.none();

        const command = interaction.options.getSubcommand(true);
        return this.some(command);
    }

    public override async run(interaction: AutocompleteInteraction, command: 'add' | 'update' | 'remove') {
        if (!interaction.guild) return;

        const settings = await this.container.api.guilds.getGuildSettings(interaction.guild.id, { create: true });
        if (settings.isErr()) {
            this.container.logger.error(settings.error);

            return await interaction.respond([
                { name: 'There was an issue fetching the guild\'s settings. Please try again later.', value: '' }
            ]);
        }

        const { voice_room_lobbies } = settings.value.data;
        switch (command) {
            case 'add':
                const existingLobbies = voice_room_lobbies.map((v) => v.channel_id);
                const existingRooms = voice_room_lobbies.map((v) => v.opened_rooms).flat();

                const filteredChannels = interaction.guild.channels.cache
                    .filter((c) => c.type === ChannelType.GuildVoice)
                    .filter((c) => !existingLobbies.includes(c.id))
                    .filter((c) => !existingRooms.includes(c.id));

                if (!filteredChannels.size) {
                    return await interaction.respond([
                        { name: 'There are no available voice channels to add to the lobby.', value: '' }
                    ]);
                }

                return await interaction.respond(filteredChannels.map((c) => (
                    { name: `🔊 ${c.name} (${c.id})`, value: c.id }
                )));
            case 'update':
            case 'remove':
                return await interaction.respond(settings.value.data.voice_room_lobbies.map((v) => {
                    const channel = interaction.guild!.channels.cache.get(v.channel_id);

                    return {
                        name: channel 
                            ? `🔊 ${channel.name} (${v.channel_id})`
                            : v.channel_id,
                        value: v.channel_id
                    }
                }));
            default:
                return await interaction.respond([
                    { name: 'Something went wrong. Please try again later.', value: '' }
                ]);
        }
	}
}