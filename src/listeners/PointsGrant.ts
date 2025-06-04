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

        const { chat_activity } = settings.value.data;
        if (!chat_activity.is_enabled) return;

        const profile = await this.container.api.getMemberProfile(message.guildId!, message.author.id, { create: true });
        if (profile.isErr()) {
            // todo: error handling & logging
            return;
        }

        const { is_on_cooldown } = profile.value.data.chat_activity;
        if (is_on_cooldown) {
            return;
        }

        const updatedProfile = await this.container.api.incrementMemberActivityPoints(message.guildId!, message.author.id, {
            activity_type: "chat"
        });
        if (updatedProfile.isErr()) {
            // todo: error handling & logging
            return;
        }

        const updatedActivity = updatedProfile.value.data.chat_activity;

        const memberRoles = message.member?.roles.cache.map((r) => r.id) || [];
        const missingRoles = updatedActivity.roles.obtained
            .map((r) => r.role_id)
            .filter((r) => !memberRoles.includes(r));

        if (missingRoles.length) {
            await message.member?.roles.add(missingRoles).catch(() => {});
        }
    }
}
