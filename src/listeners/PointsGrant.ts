import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, Message, inlineCode } from 'discord.js';

@ApplyOptions<Listener.Options>({
    event: Events.MessageCreate,
    once: false
})
export class PointsGrant extends Listener {
    public override async run(message: Message) {
        if (message.author.bot) return;

        const settings = await this.container.api.getGuildSettings(message.guildId!, { create: true });
        if (settings.isErr()) {
            // todo: error handling & logging
            return;
        }

        const { chat_activity } = settings.value;
        if (!chat_activity.is_enabled) return;

        const profile = await this.container.api.getMemberProfile(message.guildId!, message.author.id, { create: true, force: true });
        if (profile.isErr()) {
            // todo: error handling & logging
            return;
        }

        const { is_on_cooldown } = profile.value.chat_activity;
        if (is_on_cooldown) return;

        const updatedProfile = await this.container.api.incrementMemberActivityPoints(
            message.guildId!, message.author.id,
            { activity_type: "chat"}
        );
        if (updatedProfile.isErr()) {
            // todo: error handling & logging
            return;
        }

        const updatedActivity = updatedProfile.value.data;

        const memberRoles = message.member?.roles.cache.map((r) => r.id) || [];
        const missingRoles = updatedActivity.roles.obtained
            .map((r) => r.role_id)
            .filter((r) => !memberRoles.includes(r));

        /**
         * This can happen when a member leaves and rejoins.
         */
        if (missingRoles.length) {
            await message.member?.roles.add(missingRoles).catch(() => {});
        }

        /**
         * If the length is 1, we'll congratulate the member.
         */
        if (missingRoles.length === 1) {
            const roleInfo = message.guild?.roles.cache.get(missingRoles[0]);
            if (!roleInfo) return;

            await message.reply({
                content: `<@${message.author.id}> Congratulations! You have reached ${updatedActivity.points} points and unlocked the ${inlineCode(roleInfo.name.toUpperCase())} activity role!` 
            });
        }
    }
}
