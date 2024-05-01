import { type CommandInteraction, type InteractionReplyOptions, AttachmentBuilder, inlineCode } from "discord.js";
import { container } from "@sapphire/pieces";

export async function respond(interaction: CommandInteraction, options: InteractionReplyOptions) {
    if (interaction.deferred) {
        interaction.editReply(options).catch(() => null);
    } else {
        interaction.reply({
            ...options,
            ephemeral: true
        }).catch(() => null);
    }
}

export async function logToWebhook(info: string, details: any) {
    const timestamp = new Date().toLocaleTimeString('en-us', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    const errorDetails = new AttachmentBuilder(Buffer.from(details), { name: 'details.js' });

    await container.sentry.errors
        .send({
            username: container.client.user?.username,
            avatarURL: container.client.user?.avatarURL() || container.client.user?.defaultAvatarURL,
            content: `[${inlineCode(timestamp)}]: ${info}`,
            files: [errorDetails]
        })
        .catch((err) => console.log(err));
}