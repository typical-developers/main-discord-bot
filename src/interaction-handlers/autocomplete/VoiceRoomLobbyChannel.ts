import { AutocompleteInteraction, ChannelType, PermissionFlagsBits } from "discord.js";
import { InteractionHandler, InteractionHandlerTypes } from "@sapphire/framework";
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Autocomplete,
})
export class VoiceRoomLobbyChannel extends InteractionHandler {
    public override async parse(interaction: AutocompleteInteraction) {
        if (interaction.commandName !== 'voice-room-lobby') return this.none();

        const focused = interaction.options.getFocused(true);
        if (focused.name !== 'channel') return this.none();

        const command = interaction.options.getSubcommand(true);
        return this.some(command);
    }

    public override async run(interaction: AutocompleteInteraction, command: 'add' | 'update' | 'remove') {
        if (!interaction.guild)
            return;

        const settings = await this.container.api.guilds.fetch(interaction.guild.id, { createNew: true });
        if (settings.isErr()) {
            this.container.logger.error(settings.error);
            return await interaction.respond([
                { name: 'There was an issue fetching the guild\'s settings. Please try again later.', value: '' }
            ]);
        }

        const { voiceRoomLobbies, activeVoiceRooms } = settings.value;
        switch (command) {
            case 'add':
                const existingLobbies = voiceRoomLobbies.cache.map((v) => v.id);
                const existingRooms = activeVoiceRooms.cache.map((v) => v.originChannelId);

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
                return await interaction.respond(voiceRoomLobbies.cache.map((v) => {
                    const channel = interaction.guild!.channels.cache.get(v.id);

                    return {
                        name: channel 
                            ? `🔊 ${channel.name} (${v.id})`
                            : v.id,
                        value: v.id
                    }
                }));
            default:
                return await interaction.respond([
                    { name: 'Something went wrong. Please try again later.', value: '' }
                ]);
        }
	}
}