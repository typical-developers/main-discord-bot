import { ActionRow, AttachmentBuilder, ButtonInteraction, ComponentType, MessageFlags, type MessageActionRowComponent } from 'discord.js';
import { InteractionHandler, InteractionHandlerTypes, } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import type { ActivityPeriod, ActivityType } from '#/lib/structures/BaseActivitySettings';
import { leaderboardPagination } from '#/lib/util/buttons';

@ApplyOptions<InteractionHandler.Options>({
	interactionHandlerType: InteractionHandlerTypes.Button
})
export class ActivityLeaderboardPager extends InteractionHandler {
    public override async parse(interaction: ButtonInteraction) {
        if (!interaction.guildId || !interaction.channelId)
            return this.none();
        if (!interaction.customId.startsWith('activity_leaderboard'))
            return this.none();
        if (interaction.user.id !== interaction.message.interactionMetadata?.user.id) {
            await interaction.reply({
                content: "This is not your interaction! Run the command yourself to paginate the leaderboard.",
                flags: [ MessageFlags.Ephemeral ],
            });

            return this.none();
        }

        const [ _, page, activityType, timePeriod ] = interaction.customId.split('.');
        if (!page || !activityType || !timePeriod)
            return this.none();

        if (isNaN(+page))
            return this.none();

        await interaction.message.edit({
            components: interaction.message.components
                .filter((c) => c.type === ComponentType.ActionRow)
                .map((c: ActionRow<MessageActionRowComponent>) => ({
                    ...c.toJSON(),
                    components: c.components.map((c) => ({
                        ...c.toJSON(),
                        disabled: true,
                    }))
                }))
        }).catch((e) => this.container.logger.error(e));

        return this.some<{ page: number, activityTpe: string, timePeriod: string }>({ page: +page, activityTpe: activityType, timePeriod });
    }

    public async run(interaction: ButtonInteraction, { page, activityTpe, timePeriod }: { page: number, activityTpe: string, timePeriod: string }) {
        await interaction.deferUpdate();

        const settings = await this.container.api.guilds.fetch(interaction.guildId!, { createNew: true });
        if (settings.isErr()) {
            this.container.logger.error(settings.error);
            return;
        }

        const leaderboard = await settings.value.getActivityLeaderboard({
            page: page,
            activity_type: activityTpe as ActivityType,
            time_period: timePeriod as ActivityPeriod
        });
        if (leaderboard.isErr()) {
            this.container.logger.error(leaderboard.error);
            return;
        }

        const card = await leaderboard.value.generateCard();
        if (card.isErr()) {
            this.container.logger.error(card.error);
            return;
        }

        const attachment = new AttachmentBuilder(card.value, { name: 'leaderboard.png' });
        return await interaction.editReply({
            files: [ attachment ],
            components: [ leaderboardPagination(leaderboard.value) ]
        }).catch((e) => console.log(e));
    }
}