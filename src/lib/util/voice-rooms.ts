import { container } from "@sapphire/pieces";

export async function isOwner(guildId: string, channelId: string, userId: string) {
    const roomDetails = await container.api.getVoiceRoom(guildId, channelId);
    if (!roomDetails) return false;

    return roomDetails.created_by_user_id === userId
        ? true
        : false;
}