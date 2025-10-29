import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Events, Message, inlineCode } from 'discord.js';

@ApplyOptions<Listener.Options>({
    event: Events.MessageCreate,
    once: false
})
export class PointsGrant extends Listener {
    public override async run(message: Message) {
        if (!message.guild || message.author.bot)
            return;

        const settings = await this.container.api.guilds.fetch(message.guild.id, { createNew: true });
        if (settings.isErr())
            return;

        const { members, chatActivity: chatActivitySettings } = settings.value;
        if (!chatActivitySettings.isEnabled)
            return;

        const profile = await members.fetch(message.author.id, { createNew: true });
        if (profile.isErr())
            return;

        const { chatActivity: memberChatActivity } = profile.value;
        if (memberChatActivity.isOnCooldown)
            return;

        const oldCurrentRole = memberChatActivity.currentActivityRole;
        const updatedProfile = await profile.value.chatActivity.incrementPoints({ createNew: true });
        if (updatedProfile.isErr())
            return;

        const { currentActivityRoles, currentActivityRole: newCurrentRole, hasNewActivityRole } = updatedProfile.value.chatActivity;
        const memberRoles = message.member?.roles.cache.map((r) => r.id);
        const missingRoles = currentActivityRoles
            .filter((id) => !memberRoles?.includes(id));

        if (missingRoles.length)
            await message.member?.roles.add(missingRoles);

        /**
         * This check specifically changes if the current activity role from the previous profile fetch is the same id.
         * It's more precise to do it this way than to check if the length of the array for missing roles is 1.
         */
        if (updatedProfile.value.chatActivity.hasNewActivityRole(oldCurrentRole) && newCurrentRole) {
            const roleInfo = message.guild?.roles.fetch(newCurrentRole.roleId);
            if (!roleInfo)
                return;

            await message.reply({
                content: `<@${message.author.id}> Congratulations! You have reached ${newCurrentRole.requiredPoints} points and unlocked the ${inlineCode(newCurrentRole.name)} activity role!`
            });
        }
    }
}
