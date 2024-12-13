import { ScheduledTask } from '@sapphire/plugin-scheduled-tasks';
import { AttachmentBuilder, inlineCode, type Guild, type VoiceChannel } from 'discord.js';
import TaskError from '@/lib/extensions/TaskError';

export class IncrementVoiceActivity extends ScheduledTask {
    public constructor(context: ScheduledTask.LoaderContext, options: ScheduledTask.Options) {
        super(context, { ...options });
    }

    private async _getGuild(guildId: string) {
        const guild = await this.container.client.guilds.fetch(guildId);
        return guild;
    }

    private async _getChannel(guild: Guild, channelId: string) {
        const channel = await guild.channels.fetch(channelId, { force: true });
        return channel as VoiceChannel;
    }

    public async run(payload: { guildId: string; channelId: string; memberId: string; }) {
        const { voice_activity: { enabled, cooldown } } = await this.container.api.getGuildSettings(payload.guildId);
        if (!enabled) throw new TaskError({ task: 'IncrementVoiceActivity', payload, message: "Points are not enabled for the guild." });

        const guild = await this._getGuild(payload.guildId);
        const channel = await this._getChannel(guild, payload.channelId);
        if (!guild || !channel) throw new TaskError({ task: 'IncrementVoiceActivity', payload, message: 'The guild/channel does not exist.' });

        const time = Math.floor(new Date().getTime() / 1000);
        const currentProfile = await this.container.api.getMemberProfile(payload.guildId, payload.memberId);
        if (time < (new Date(currentProfile.voice_activity.last_grant).getTime() / 1000) + cooldown) return;

        const members = channel.members;
        const list = members.map((m) => m.id);
        const active = members
            .filter((m) => !m.voice.mute)
            .filter((m) => !m.voice.deaf)
            .filter((m) => !m.voice.suppress)
            .map((m) => m.id);

        if (!list.includes(payload.memberId)) throw new TaskError({ task: 'IncrementVoiceActivity', payload, message: "Member is no longer connected to voice chat." });

        if (!active.includes(payload.memberId)) return; // if the member themselves is mute/deaf, skip.
        if (active.length <= 1) return; // If there's only <= one person not mute/deaf, skip.
        if (list.length <= 1) return; // If there's only <= one member in voice, skip.

        const member = await guild.members.fetch(payload.memberId);
        const updatedProfile = await this.container.api.incrementMemberPoints(payload.guildId, payload.memberId, 'voice');
        console.log(currentProfile, updatedProfile);
        const memberRoles = member.roles.cache.map((r) => r.id) || [];
        const missingRoles = updatedProfile.voice_activity.current_roles
            .map((r) => r.role_id)
            .filter((r) => !memberRoles.includes(r));

        if (missingRoles.length) {
            const added = await member.roles.add(missingRoles).catch(() => false).then(() => true);
            if (!added) return;
        }

        if (missingRoles.length === 1) {
            const role = await guild.roles.fetch(missingRoles[0], { force: true });
            const activityRole = updatedProfile.voice_activity.current_roles.find(({ role_id }) => role_id === missingRoles[0]);
            if (!role || !activityRole) return;

            const notice = new AttachmentBuilder(
                await this.container.imageGenerators.generateRankUpNotice({
                    message: `@${member.user.username} congrats, you've reached ${activityRole.required_points} points and unlocked a new role!`,
                    role: { name: role.name, color: role.hexColor },
                }),
                { name: `${member.id}-rankup.png` },
            );

            try {
                await channel.send({ content: `<@${member.user.id}>`, files: [notice] });
            }
            catch (e) {
                await channel.send({
                    content: `<@${member.user.id}> congrats, you've reached ${inlineCode(activityRole.required_points.toString())} points and unlocked the ${inlineCode(role.name)} activity role!`,
                }).catch((e) => console.log(e));
            }
        }
    }
}