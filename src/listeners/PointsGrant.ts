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
        if (!message.guild) return;

        const settings = await this.container.api.guilds.getGuildSettings(message.guild.id, { create: true });
        if (settings.isErr()) {
            return;
        }

        if (!settings.value.data.chat_activity.is_enabled) return;

        const profile = await this.container.api.members.getMemberProfile(message.guild.id, message.author.id, { create: true });
        if (profile.isErr()) {
            return;
        }

        if (profile.value.data.chat_activity.is_on_cooldown) return;
        const updatedProfile = await this.container.api.members.incrementChatActivity(message.guild.id, message.author.id);
        if (updatedProfile.isErr()) {
            return;
        }

        const { current_activity_role_ids } = updatedProfile.value.data.chat_activity;
        const memberRoles = message.member?.roles.cache.map((r) => r.id);
        const missingRoles = current_activity_role_ids
            .filter((rId) => !memberRoles?.includes(rId));

        if (missingRoles.length) {
            await message.member?.roles.add(missingRoles);
        }

        /**
         * This check specifically changes if the current activity role from the previous profile fetch is the same id.
         * It's more precise to do it this way than to check if the length of the array for missing roles is 1.
         */
        const oldCurrentRole = profile.value.data.chat_activity.current_activity_role;
        const newCurrentRole = updatedProfile.value.data.chat_activity.current_activity_role;
        const isNewCurrentRole = (!oldCurrentRole && newCurrentRole) || (oldCurrentRole && newCurrentRole && oldCurrentRole.role_id !== newCurrentRole.role_id);

        if (isNewCurrentRole) {
            const roleInfo = message.guild?.roles.cache.get(newCurrentRole.role_id);
            if (!roleInfo) return;

            await message.reply({
                content: `<@${message.author.id}> Congratulations! You have reached ${newCurrentRole.required_points} points and unlocked the ${inlineCode(newCurrentRole.name)} activity role!`
            });
        }
    }
}
