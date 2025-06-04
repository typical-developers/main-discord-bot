import { type ChatInputCommandErrorPayload, Listener, UserError } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { SubcommandPluginEvents } from '@sapphire/plugin-subcommands';
import { respond, logToWebhook } from '@/lib/util/error-sentry';

@ApplyOptions<Listener.Options>({
    event: SubcommandPluginEvents.ChatInputSubcommandError,
    once: false
})
export class ChatInputErrorSentry extends Listener {
    public override async run(error: Error | UserError, { interaction }: ChatInputCommandErrorPayload) {
        if (process.env.DEV_DEPLOYMENT === 'true' && !(error instanceof UserError)) {
            console.log(error);
            return respond(interaction, {
                content: 'Something went wrong. Check console for details.'
            });
        }

        switch (true) {
            // No need to log a UserError.
            case error instanceof UserError:
                return respond(interaction, {
                    content: error.message
                });
            case error instanceof Error:
                await logToWebhook(error.message, error.stack);
                break;
        }

        return respond(interaction, {
            content: 'Something went wrong. This has been forwarded internally to the developers.'
        });
    }
}
