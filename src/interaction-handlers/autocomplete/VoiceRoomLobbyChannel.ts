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
	}
}