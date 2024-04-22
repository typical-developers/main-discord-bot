import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { type ApplicationCommandOptionData, type User, ApplicationCommandOptionType, AttachmentBuilder, ApplicationCommandType } from 'discord.js';
import { ProfileCard, type ProfileCardDetails } from '#lib/extensions/ProfileCard';
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

    private async generateCard(interaction: Command.ContextMenuCommandInteraction | Command.ChatInputCommandInteraction, user: User) {
        if (!interaction.guild) return;

        const points = await this.container.api.getMemberProfile(interaction.guild.id, user.id);

        if (!points) {
            return interaction.reply({
                content: 'This user has no points.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ fetchReply: true });

        const { rank, point_amount, current_activity_roles, next_activity_role } = points;
        const details: ProfileCardDetails = {
            username: user.username,
            displayName: user.displayName.normalize("NFD"),
            avatarUrl: user.avatarURL({ forceStatic: true, size: 128 }) || user.defaultAvatarURL,
            rank: rank,
            stats: {
                activityProgression: {
                    totalPoints: point_amount,
                    currentProgress: point_amount - current_activity_roles[0].required_points,
                    requiredProgress: next_activity_role.required_points - current_activity_roles[0].required_points
                }
            },
            tags: []
        };

        if (current_activity_roles[0].role_id) {
            const role = await interaction.guild.roles.fetch(current_activity_roles[0].role_id, { force: true });

            if (role) {
                details.tags!.push({
                    name: role.name.toUpperCase(),
                    color: hexToRGB(role.hexColor)
                });
            }
        }
        
        const card = new ProfileCard(details);
        const attachment = new AttachmentBuilder(await card.draw(), { name: 'card.png' });

        return interaction.editReply({
            files: [attachment]
        });
    }

    public override async contextMenuRun(interaction: Command.ContextMenuCommandInteraction) {
        const user = this.container.client.users.cache.get(interaction.targetId) || (await this.container.client.users.fetch(interaction.targetId, { force: true }));
        return this.generateCard(interaction, user);
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const user = interaction.options.getUser('user') || interaction.user;
        return this.generateCard(interaction, user);
    }
}
