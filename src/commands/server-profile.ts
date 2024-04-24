import { Command, UserError } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { type ApplicationCommandOptionData, GuildMember, ApplicationCommandOptionType, AttachmentBuilder, ApplicationCommandType } from 'discord.js';
import { ActivityCardStyles } from '@typical-developers/api-types/graphql';
import { ProfileCard } from '#lib/extensions/ProfileCard';
import { hexToRGB } from '#lib/util/color';

@ApplyOptions<Command.Options>({
    description: 'Get information on a server member!'
})
export class ActivityDetails extends Command {
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
     * @param style
     */
    private async getCardStyle(style: ActivityCardStyles, member: GuildMember) {
        switch (style) {
            case ActivityCardStyles.Discord:
                const user = await member.user.fetch(true);

                return {
                    backgroundImageUrl: user.bannerURL({ forceStatic: true, size: 1024 })
                };
            // Basically ActivityCardStyles.Discord and anything not yet implemented.
            default:
                return {};
        }
    }

    private async generateCard(interaction: Command.ContextMenuCommandInteraction | Command.ChatInputCommandInteraction, member: GuildMember | undefined) {
        if (!interaction.guild) return;
        if (!member) return;

        const points = await this.container.api.getMemberProfile(interaction.guild.id, member.id);

        if (!points) {
            throw new UserError({ identifier: 'NO_POINTS', message: 'This user has no activity points in this guild.' })
        }

        await interaction.deferReply({ fetchReply: true });

        const { rank, point_amount, current_activity_roles, next_activity_role, activity_card_style } = points;
        const cardStyle = await this.getCardStyle(activity_card_style, member);
        const tags: { name: string; color: `${string}, ${string}, ${string}` }[] = [];

        for (const activityRole of current_activity_roles) {
            if (!activityRole.role_id) break; // This means there are no activity roles.

            const role = await interaction.guild.roles.fetch(activityRole.role_id, { force: true });

            if (role) {
                tags.push({
                    name: role.name.toUpperCase(),
                    color: hexToRGB(role.hexColor)
                });
            }
        }

        const card = new AttachmentBuilder(
            await new ProfileCard({
                username: member.user.username,
                displayName: member.displayName,
                // Server Profile Avatar -> User Avatar -> Default User Avatar
                avatarUrl: member.avatarURL({ forceStatic: true, size: 128 }) || member.user.avatarURL({ forceStatic: true, size: 128 }) || member.user.defaultAvatarURL,
                rank: rank,
                stats: {
                    activityProgression: {
                        totalPoints: point_amount,
                        currentProgress: point_amount - current_activity_roles[0].required_points,
                        requiredProgress: next_activity_role.required_points - current_activity_roles[0].required_points
                    }
                },
                tags: tags,
                ...cardStyle
            }).draw(),
            { name: 'card.png' }
        );

        return interaction.editReply({
            files: [card]
        });
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
        } else {
            if (!interaction.member) return;
            member = await interaction.guild?.members.fetch(interaction.member.user.id);
        }

        return this.generateCard(interaction, member);
    }
}
