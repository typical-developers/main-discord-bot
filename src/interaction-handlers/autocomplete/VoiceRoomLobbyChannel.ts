import { AutocompleteInteraction, ChannelType, PermissionFlagsBits } from "discord.js";
import { InteractionHandler, InteractionHandlerTypes } from "@sapphire/framework";
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Autocomplete,
})
export class RobloxUsernameAutcomplete extends InteractionHandler {
    public override async parse(interaction: AutocompleteInteraction) {
        const focused = interaction.options.getFocused(true);

        if (focused.name !== 'channel') return this.none();

        const command = interaction.options.getSubcommand(true);
        return this.some(command);
    }

    public override async run(interaction: AutocompleteInteraction, command: string) {
        const settings = await this.container.api.getGuildSettings(interaction.guildId!);
        if (settings.isErr()) {
            return interaction.respond([{
                name: "Something went wrong. Try again later.",
                value: "NONE"
            }]);
        }

        if (command === 'add-voice-room-lobby') {
            const existingLobbies = settings.value.voice_rooms.map((r) => r.channel_id);
            const voiceChannels = interaction.guild?.channels.cache
                .filter((c) => c.type === ChannelType.GuildVoice)
                .filter((c) => !existingLobbies.includes(c.id));

            if (!voiceChannels?.size) {
                return interaction.respond([{
                    name: "Unable to find any voice channels.",
                    value: "NONE"
                }]);
            }

            return interaction.respond(voiceChannels.map((c) => ({
                name: c.name,
                value: c.id
            })));
        } else {
            if (settings.value.voice_rooms.length === 0) {
                return interaction.respond([{
                    name: "Unable to find any voice channels.",
                    value: "NONE"
                }]);
            }

            return interaction.respond(settings.value.voice_rooms.map((r) => {
                const channel = interaction.guild?.channels.cache.get(r.channel_id);

                return {
                    name: channel?.name || "Unknown Channel",
                    value: r.channel_id
                }
            }));
        }
	}
}