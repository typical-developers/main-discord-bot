import { type ContextMenuCommandErrorPayload, Events, Listener, UserError } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { respond, logToWebhook } from '@/lib/util/error-sentry';

@ApplyOptions<Listener.Options>({
    event: Events.ContextMenuCommandError,
    once: false
})
export class ContextErrorSentry extends Listener {
    public override async run(error: Error | UserError, { interaction }: ContextMenuCommandErrorPayload) {
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
