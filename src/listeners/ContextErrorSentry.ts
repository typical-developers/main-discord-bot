import { ContextMenuCommandErrorPayload, Events, Listener, UserError } from "@sapphire/framework";
import { ApplyOptions } from "@sapphire/decorators";
import { AttachmentBuilder, ContextMenuCommandInteraction, InteractionReplyOptions, inlineCode } from "discord.js";
import { GraphQLResponseErrors } from "#lib/extensions/GraphQLResponseErrors";

@ApplyOptions<Listener.Options>({
    event: Events.ContextMenuCommandError,
    once: false
})
export class ChatInputErrorSentry extends Listener {
    private respond(interaction: ContextMenuCommandInteraction, options: InteractionReplyOptions) {
        if (interaction.deferred) {
            interaction.editReply(options);
        } else {
            interaction.reply({
                ...options,
                ephemeral: true
            });
        }
    }

    private async sendWebhook(info: string, details: any) {
        const timestamp = new Date().toLocaleTimeString('en-us' , {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });

        const errorDetails = new AttachmentBuilder(Buffer.from(details), { name: 'details.js' });

        await this.container.sentry.errors.send({
            username: this.container.client.user?.username,
            avatarURL: this.container.client.user?.avatarURL() || this.container.client.user?.defaultAvatarURL,
            content: `[${inlineCode(timestamp)}]: ${info}`,
            files: [errorDetails]
        }).catch((err) => console.log(err));
    }

    public override async run(error: Error | UserError | GraphQLResponseErrors, { interaction }: ContextMenuCommandErrorPayload) {
        if (process.env.DEV_DEPLOYMENT === 'true' && !(error instanceof UserError)) {
            console.log(error);
            return this.respond(interaction, {
                content: 'Something went wrong. Check console for details.'
            });
        }

        switch (true) {
            // No need to log a UserError.
            case error instanceof UserError:
                return this.respond(interaction, {
                    content: error.message
                });
            case error instanceof GraphQLResponseErrors:
                const { message, errors } = error as GraphQLResponseErrors;
                await this.sendWebhook(message, JSON.stringify(errors, null, 2));
                break;
            case error instanceof Error:
                await this.sendWebhook(error.message, error.stack);
                break;
        }

        return this.respond(interaction, {
            content: 'Something went wrong. This has been forwarded internally to the developers.'
        });
    }
}