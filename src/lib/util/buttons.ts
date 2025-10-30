import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type GuildActivityLeaderboard from "#/lib/structures/GuildActivityLeaderboard";
import { emojis } from "#/lib/constants/emojis";

export function leaderboardPagination(leaderboard: GuildActivityLeaderboard) {
    const previousPage = leaderboard.currentPage - 1;
    const nextPage = leaderboard.currentPage + 1;

    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            emoji: { id: emojis.NavigatePrevious },
            customId: `activity_leaderboard.${previousPage}.${leaderboard.activityType}.${leaderboard.timePeriod}`,
            style: ButtonStyle.Primary,
            disabled: leaderboard.currentPage === 1
        }),
        new ButtonBuilder({
            label: `${leaderboard.currentPage} / ${leaderboard.totalPages}`,
            custom_id: `activity_leaderboard_jump.${leaderboard.totalPages}.${leaderboard.activityType}.${leaderboard.timePeriod}`,
            style: ButtonStyle.Secondary,
            disabled: true,
        }),
        new ButtonBuilder({
            emoji: { id: emojis.NavigateNext },
            customId: `activity_leaderboard.${nextPage}.${leaderboard.activityType}.${leaderboard.timePeriod}`,
            style: ButtonStyle.Primary,
            disabled: !leaderboard.hasNextPage
        }),
        new ButtonBuilder({
            emoji: { id: emojis.Refresh },
            custom_id: `activity_leaderboard.${leaderboard.currentPage}.${leaderboard.activityType}.${leaderboard.timePeriod}`,
            style: ButtonStyle.Secondary,
        }),
    )
}

export function profileCard() {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder({
            emoji: { id: emojis.Refresh },
            custom_id: 'profile_card_refresh',
            style: ButtonStyle.Secondary,
        })
    )
}