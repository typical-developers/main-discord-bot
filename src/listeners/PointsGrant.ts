import type { ActivityRoleDetails } from '@typical-developers/api-types/graphql';
import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, Message, inlineCode } from 'discord.js';

@ApplyOptions<Listener.Options>({
    event: Events.MessageCreate,
    once: false
})
export class PointsGrant extends Listener {
    public override async run(message: Message) {
        if (message.author.bot || message.system) return;
        if (!message.guildId) return;

        const { activity_tracking, activity_tracking_grant, activity_tracking_cooldown } = await this.container.api.getGuildSettings(message.guildId);
        if (!activity_tracking) return;

        const currentProfile = await this.container.api.getMemberProfile(message.guildId, message.author.id);
        const time = Math.floor(new Date().getTime() / 1000);

        if (!currentProfile) return;
        if (currentProfile.activity_info.last_grant_epoch > time) return;

        const updatedProfile = await this.container.api.incrementActivityPoints(message.guildId, message.author.id, activity_tracking_grant, activity_tracking_cooldown);
        if (!updatedProfile) return;

        const memberRoles = message.member?.roles.cache.map((r) => r.id) || [];
        const missingActivityRoles = updatedProfile.activity_info.progression.current_roles
            .map((r: ActivityRoleDetails) => r.role_id)
            .filter((r: string | null) => r !== null)
            .filter((r: string) => !memberRoles.includes(r)) as string[];

        if (missingActivityRoles.length) {
            const added = await message.member?.roles.add(missingActivityRoles).catch(() => false).then(() => true);
            if (!added) return;
        }

        if (missingActivityRoles.length === 1) {
            const role = message.guild?.roles.cache.get(missingActivityRoles[0]);
            if (!role) return;

            message.reply({
                content: `You have unlocked the ${inlineCode(role.name)} activity role!`
            });
        }
    }
}
