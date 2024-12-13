import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { GuildMember, ApplicationCommandOptionType, ApplicationCommandType, type ApplicationCommandOptionData, AttachmentBuilder } from 'discord.js';

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
                name: process.env.DEV_DEPLOYMENT === 'true'
                    ? `stging-${this.name}`
                    : this.name,
                description: this.description,
                options: this._options,
                dmPermission: false
            })
            .registerContextMenuCommand({
                type: ApplicationCommandType.User,
                name: "Get User's Profile",
                dmPermission: false
            });
    }

    private async generateCard(interaction: Command.ContextMenuCommandInteraction | Command.ChatInputCommandInteraction, member: GuildMember) {
        const settings = await this.container.api.getGuildSettings(interaction.guildId!);
        if (!settings.voice_activity.enabled && !settings.chat_activity.enabled) {
            return await interaction.reply({
                ephemeral: true,
                content: 'No activity tracking is enabled for this guild.',
            });
        }

        await interaction.deferReply({ fetchReply: true });

        const profile = await this.container.api.getMemberProfile(interaction.guildId!, member.id);

        const attachment = new AttachmentBuilder(
            await this.container.imageGenerators.generateProfileCard({
                displayName: member.displayName,
                username: member.user.username,
                avatar: member.avatarURL({ forceStatic: true, size: 128 }) || member.user.avatarURL({ forceStatic: true, size: 128 }) || member.user.defaultAvatarURL,
                activity: {
                    chat: {
                        rank: profile.chat_activity.rank, totalPoints: profile.chat_activity.points,
                        ...(profile.chat_activity.next_role) 
                        ? {
                            currentProgress: profile.chat_activity.next_role.required_points - (profile.chat_activity.current_roles[0]?.required_points || 0) - profile.chat_activity.remaining_progress,
                            requiredProgress: profile.chat_activity.next_role.required_points - (profile.chat_activity.current_roles[0]?.required_points || 0)
                        }
                        : { currentProgress: 0, requiredProgress: 0 }
                    },
                    voice: {
                        rank: profile.voice_activity.rank, totalPoints: profile.voice_activity.points,
                        ...(profile.voice_activity.next_role) 
                        ? {
                            currentProgress: profile.voice_activity.next_role.required_points - (profile.voice_activity.current_roles[0]?.required_points || 0) - profile.voice_activity.remaining_progress,
                            requiredProgress: profile.voice_activity.next_role.required_points - (profile.voice_activity.current_roles[0]?.required_points || 0)
                        }
                        : { currentProgress: 0, requiredProgress: 0 }
                    }
                }
            }),
            { name: `${member.id}-profile-card.png` }
        );

        return interaction.editReply({ files: [attachment] });
    }

    public override async contextMenuRun(interaction: Command.ContextMenuCommandInteraction) {
        const member = await interaction.guild?.members.fetch(interaction.targetId).catch(() => undefined);

        if (!member) {
            return await interaction.reply({
                content: 'Unable to fetch the member\'s details.',
                ephemeral: true
            });
        }

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
            member = await interaction.guild?.members.fetch(user.id).catch(() => undefined);
        }
        else {
            if (!interaction.member) return;
            member = await interaction.guild?.members.fetch(interaction.member.user.id).catch(() => undefined);
        }

        if (!member) {
            return await interaction.reply({
                content: 'Unable to fetch the member\'s details.',
                ephemeral: true
            });
        }

        return this.generateCard(interaction, member);
    }
}
