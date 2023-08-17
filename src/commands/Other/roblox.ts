import { ApplyOptions } from '@sapphire/decorators';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { PermissionFlagsBits, type ApplicationCommandOptionData, ApplicationCommandOptionType, AttachmentBuilder } from 'discord.js';
import noblox, { type UniverseInformation } from 'noblox.js';
import UserProfile from '#lib/htmltoimage/RobloxInfo/UserProfile';
import ExperiencePage from '#lib/htmltoimage/RobloxInfo/ExperienceInfo';
import type { AgeRecommendation, Badges, Universe, User } from '#lib/types/fetch';

@ApplyOptions<Subcommand.Options>({
	description: 'Fetch information from Roblox.',
	subcommands: [
		{ name: 'user', chatInputRun: 'userInfo' },
		{ name: 'experience', chatInputRun: 'experienceInfo' }
	]
})
export class ActivtyCardCommand extends Subcommand {
	readonly commandOptions: ApplicationCommandOptionData[] = [
		{
			type: ApplicationCommandOptionType.Subcommand,
			name: 'user',
			description: 'Fetch a user.',
			options: [
				{
					type: ApplicationCommandOptionType.Number,
					name: 'player',
					description: 'Search player by username.',
					autocomplete: true,
					required: true
				}
			]
		},
		{
			type: ApplicationCommandOptionType.Subcommand,
			name: 'experience',
			description: 'Fetch an experience.',
			options: [
				{
					type: ApplicationCommandOptionType.Number,
					name: 'place-id',
					description: 'Search experience by place id.',
					required: true
				}
			]
		}
	];

	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand({
			name: this.name,
			description: this.description,
			options: this.commandOptions,
			defaultMemberPermissions: PermissionFlagsBits.ManageRoles
		});
	}

	public override async autocompleteRun(interaction: Subcommand.AutocompleteInteraction) {
		const CHOICES = [];

		switch (interaction.options.getSubcommand()) {
			case 'user':
				const USERNAME = interaction.options.getNumber('player', true);

				const SEARCH = await fetch(`https://www.roblox.com/search/users/results?keyword=${USERNAME}&maxRows=25&startIndex=0`)
					.then((d) => d.json())
					.catch(() => null)
					.then((d) => d);
				if (!SEARCH || !SEARCH?.UserSearchResults) return;

				for (let user of SEARCH.UserSearchResults) {
					CHOICES.push({
						name: `@${user.Name} (${user.UserId})`,
						value: user.UserId
					});
				}

				break;
			default:
				break;
		}

		await interaction.respond(CHOICES);
	}

	private async getUserCardInfo(userId: number) {
		const DETAILS = await noblox.getPlayerInfo(userId).catch(() => null);
		const AVATAR = await noblox
			.getPlayerThumbnail(userId, '150x150', 'png', true, 'headshot')
			.then((a) => a[0].imageUrl)
			.catch(() => null);
		if (!DETAILS || !AVATAR) return null;

		const ADMINBADGE = await fetch(`https://accountinformation.roblox.com/v1/users/${userId}/roblox-badges`)
			.then((d) => d.json())
			.catch(() => null)
			.then((d: Badges) => {
				if (!d || d.findIndex(({ id }: any) => id === 1) === -1) return false;

				return true;
			});

		// remove this whenever noblox decides to actually return it in their player info fetch
		const VERIFIEDBADGE = await fetch(`https://users.roblox.com/v1/users/${userId}`)
			.then((d) => d.json())
			.catch(() => null)
			.then((d: User) => {
				if (!d || !d.hasVerifiedBadge) return false;

				return true;
			});

		return {
			username: DETAILS?.username,
			globalName: DETAILS?.displayName,
			avatarURL: AVATAR,
			flags: {
				isVerified: VERIFIEDBADGE,
				isAdmin: ADMINBADGE,
				isBanned: DETAILS?.isBanned
			},
			stats: {
				friends: DETAILS?.friendCount || 0,
				followers: DETAILS?.followerCount || 0,
				following: DETAILS?.followingCount || 0
			},
			previousNames: DETAILS?.oldNames || [],
			about: DETAILS?.blurb,
			created: new Date(DETAILS?.joinDate || '')
		};
	}

	public async userInfo(interaction: Subcommand.ChatInputCommandInteraction) {
		const USERID = interaction.options.getNumber('player', true);

		const INFO = await this.getUserCardInfo(USERID);
		if (!INFO) return;

		await interaction.deferReply({ fetchReply: true });

		const PROFILE = new UserProfile(INFO).draw();

		const ATTACHMENT = new AttachmentBuilder(await PROFILE, { name: 'user-profile.png' });
		return interaction.editReply({
			files: [ATTACHMENT]
		});
	}

	private async getExperienceInfo(placeId: number) {
		const DETAILS: Universe = await fetch(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`)
			.then((d) => d.json())
			.catch(() => null)
			.then((d) => {
				if (!d.universeId) return null;
				return d.universeId
			});

		if (!DETAILS) return null;

		const UNIVERSE = (await noblox.getUniverseInfo([DETAILS.universeId!]).catch(() => null)) as unknown as UniverseInformation[];
		if (!UNIVERSE) return null;

		const AGERECOMMENDATION = await fetch(`https://apis.roblox.com/experience-guidelines-api/experience-guidelines/get-age-recommendation`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				universeId: UNIVERSE[0].id
			})
		})
			.then((d) => d.json())
			.catch(() => null)
			.then((d: AgeRecommendation) => {
				if (!d) return null;

				let { ageRecommendationDetails } = d;
				return `${ageRecommendationDetails.summary.ageRecommendation.displayName} - ${ageRecommendationDetails.descriptorUsages[0].descriptor.displayName}`;
			});

		const THUMBNAIL = await noblox
			.getThumbnails([
				{
					targetId: UNIVERSE[0].rootPlaceId,
					type: 'GameThumbnail',
					size: '768x432',
					format: 'png'
				}
			])
			.catch(() => null);
		if (!THUMBNAIL) return null;

		return {
			name: UNIVERSE[0].name,
			creator: UNIVERSE[0].creator.name,
			rating: AGERECOMMENDATION || undefined,
			thumbnail: THUMBNAIL[0].imageUrl || '',
			description: UNIVERSE[0].description,
			dates: {
				created: new Date(UNIVERSE[0].created),
				updated: new Date(UNIVERSE[0].updated)
			},
			stats: {
				active: UNIVERSE[0].playing || 0,
				visits: UNIVERSE[0].visits || 0,
				favorites: UNIVERSE[0].favoritedCount || 0
			}
		};
	}

	public async experienceInfo(interaction: Subcommand.ChatInputCommandInteraction) {
		const UNIVERSEID = interaction.options.getNumber('place-id', true);

		const UNIVERSEDETAILS = await this.getExperienceInfo(UNIVERSEID);
		if (!UNIVERSEDETAILS) return;

		await interaction.deferReply({ fetchReply: true });

		const EXPERIENCE = new ExperiencePage(UNIVERSEDETAILS).draw();

		const ATTACHMENT = new AttachmentBuilder(await EXPERIENCE, { name: 'experience.png' });
		return interaction.editReply({
			files: [ATTACHMENT]
		});
	}
}
