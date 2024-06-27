import { type CommandInteraction, type InteractionReplyOptions, AttachmentBuilder, inlineCode } from "discord.js";
import { container } from "@sapphire/pieces";

/**
 * Modify or respond to the original interaction that caused the error.
 * @param interaction The original interaction.
 * @param options Options that will apply to the response.
 */
export async function respond(interaction: CommandInteraction, options: InteractionReplyOptions) {
    if (interaction.deferred) {
        await interaction.editReply(options).catch(() => null);
    } else {
        await interaction.reply({
            ...options,
            ephemeral: true
        }).catch(() => null);
    }
}

/**
 * Log the error to the sentry webhook.
 * @param info Error information
 * @param details Extra details about the error.
 */
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