import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandlerTypes, InteractionHandler } from '@sapphire/framework';
import { AutocompleteInteraction, type ApplicationCommandOptionChoiceData } from 'discord.js';
import noblox from 'noblox.js';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Autocomplete,
	enabled: false
})
export class RobloxAutocompleteInteraction extends InteractionHandler {
	public override async parse(interaction: AutocompleteInteraction) {
		if (interaction.commandName !== 'roblox') return this.none();

		const CHOICES: ApplicationCommandOptionChoiceData[] = [];
		const FOCUSED = interaction.options.getFocused(true);
		if (!FOCUSED.value.length) return this.none();

		switch (FOCUSED.name) {
			case 'player': {
				const SEARCHRESULTS = await fetch(`https://www.roblox.com/search/users/results?keyword=${FOCUSED.value}&maxRows=100&startIndex=0`)
					.then((d) => d.json())
					.catch(() => null)
					.then(async (d) => {
						if (!d) return null;

						if (!d.UserSearchResults) {
							const USERID = await noblox.getIdFromUsername(FOCUSED.value).catch(() => null);
							if (!USERID) return this.none();

							const PLAYERINFO = await noblox.getPlayerInfo(USERID).catch(() => null);
							if (!PLAYERINFO) return this.none();

							return [
								{
									userId: USERID,
									username: PLAYERINFO.username
								}
							];
						}

						const USERS = d.UserSearchResults.map((u: any) => ({
							userId: u.UserId,
							username: u.Name
						}));

						return USERS;
					});

				if (!SEARCHRESULTS) break;

				for (let user of SEARCHRESULTS) {
					CHOICES.push({
						name: `@${user.username} (${user.userId})`,
						value: user.userId
					});
				}

				break;
			}
			default:
				break;
		}

		return this.some(CHOICES.slice(0, 25));
	}

	public override async run(interaction: AutocompleteInteraction, choices: ApplicationCommandOptionChoiceData[]) {
		return interaction.respond(choices);
	}
}
