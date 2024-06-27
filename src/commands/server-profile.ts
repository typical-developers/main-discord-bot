import { Command, UserError } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { type ApplicationCommandOptionData, GuildMember, ApplicationCommandOptionType, ApplicationCommandType, AttachmentBuilder } from 'discord.js';
import { ProfileCardStyles } from '@typical-developers/api-types/graphql';
import { ProfileCard, ProfileCardCustomization } from '#lib/extensions/ProfileCard';
import { hexToRGB } from '#lib/util/color';
import { imageToBase64 } from '#lib/util/files';

@ApplyOptions<Command.Options>({
    description: 'Get information on a server member!'
})
export class ServerProfile extends Command {
    readonly _options: ApplicationCommandOptionData[] = [
        {
            type: ApplicationCommandOptionType.User,
            name: 'user',
            description: "The member you'd like fetch an activity card for.",
            required: false
        }
    ];

    public override async registerApplicationCommands(registry: Command.Registry) {
        registry
            .registerChatInputCommand({
                name: this.name,
                description: this.description,
                options: this._options
            })
            .registerContextMenuCommand({
                type: ApplicationCommandType.User,
                name: "Get User's Profile"
            });
    }

    /**
     * Get the current card styling.
     * TODO: In the future, move this to a separate util function.
     * @param {ProfileCardStyles} style The style to apply to the card.
     * @returns {Promise<ProfileCardCustomization>}
     */
    private async getCardStyle(style: ProfileCardStyles, member: GuildMember): Promise<ProfileCardCustomization> {
        switch (style) {
            case ProfileCardStyles.Discord:
                const user = await member.user.fetch(true);

                return {
                    backgroundImageUrl: user.bannerURL({ forceStatic: true, size: 1024 })
                };
            case ProfileCardStyles.Galaxies:
                return {
                    backgroundImageUrl: `data:image/png;base64,${imageToBase64('/assets/images/profile-galaxies.png')}`,
                    progressBar: {
                        gradient1: `#4DBCFA`,
                        gradient2: `#8466FD`
                    }
                }
            case ProfileCardStyles.Topography:
                return {
                    backgroundImageUrl: `data:image/png;base64,${imageToBase64('/assets/images/profile-topography.png')}`,
                    progressBar: {
                        gradient1: `#DB0000`,
                        gradient2: `#DB0035`
                    }
                }
            // Anything not yet implemented.
            default:
                return {};
        }
    }

    private async generateCard(interaction: Command.ContextMenuCommandInteraction | Command.ChatInputCommandInteraction, member: GuildMember | undefined) {
        if (!member) return;
        if (member.user.bot) return;
        if (!interaction.guild) return;

        const { activity_tracking } = await this.container.api.getGuildSettings(interaction.guild.id);
        if (!activity_tracking) {
            throw new UserError({
                identifier: 'TRACKING_DISBALED',
                message: 'Activity tracking is not enabled for this guild.'
            });
        }

        const profile = await this.container.api.getMemberProfile(interaction.guild.id, member.id);
        if (!profile) {
            throw new UserError({
                identifier: 'NO_PROFILE',
                message: 'This user has no profile in this guild. This is likely because they have never talked here.'
            });
        }

        await interaction.deferReply({ fetchReply: true });

        const { activity_info } = profile;
        const { progression } = activity_info;
        progression.current_roles.reverse();

        const tags: { name: string; color: `${string}, ${string}, ${string}` }[] = [];
        for (const activityRole of activity_info.progression.current_roles) {
            const role = await interaction.guild.roles.fetch(activityRole.role_id, { force: true });

            if (role) {
                tags.push({
                    name: role.name.toUpperCase(),
                    color: hexToRGB(role.hexColor)
                });
            }
        }

        tags.reverse();

        const card = new AttachmentBuilder(
            await new ProfileCard({
                username: member.user.username,
                // Server Nickanme -> User Display Name
                displayName: member.nickname || member.displayName,
                // Server Avatar -> User Avatar -> Default Avatar
                avatarUrl: member.avatarURL({ forceStatic: true, size: 128 }) || member.user.avatarURL({ forceStatic: true, size: 128 }) || member.user.defaultAvatarURL,
                rank: activity_info.rank,
                stats: {
                    activityProgression: {
                        totalPoints: activity_info.points,
                        ...(progression.next_role?.required_points
                            ? {
                                currentProgress: progression.next_role.required_points - (progression.current_roles[0]?.required_points || 0) - progression.remaining_progress,
                                requiredProgress: progression.next_role.required_points - (progression.current_roles[0]?.required_points || 0)
                            }
                            : { currentProgress: 0, requiredProgress: 0 }
                        )
                    }
                },
                tags: tags,
                ...await this.getCardStyle(profile.card_style, member)
                // ...await this.getCardStyle(Math.floor(Math.random() * Object.entries(ProfileCardStyles).length), member)
            }).draw(),
            { name: 'card.png' }
        );

        return await interaction.editReply({ files: [card] });
    }

    public override async contextMenuRun(interaction: Command.ContextMenuCommandInteraction) {
        const member = await interaction.guild?.members.fetch(interaction.targetId);

        return this.generateCard(interaction, member);
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        let member: GuildMember | undefined;

        const user = interaction.options.getUser('user');

        /**
         * This is a lot more hacky than it should be.
         * Should look into how to make this better, but based on types, data returned can be different.
         */
        if (user) {
            member = await interaction.guild?.members.fetch(user.id);
        }
        else {
            if (!interaction.member) return;
            member = await interaction.guild?.members.fetch(interaction.member.user.id);
        }

        return this.generateCard(interaction, member);
    }
}
