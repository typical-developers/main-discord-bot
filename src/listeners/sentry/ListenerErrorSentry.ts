import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { AttachmentBuilder, inlineCode } from 'discord.js';
import { GraphQLResponseErrors } from '@/lib/extensions/GraphQLResponseErrors';

@ApplyOptions<Listener.Options>({
    event: Events.ListenerError,
    once: false
})
export class ListenerErrorSentry extends Listener {
    private async sendWebhook(info: string, details: any) {
        const timestamp = new Date().toLocaleTimeString('en-us', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const errorDetails = new AttachmentBuilder(Buffer.from(details), { name: 'details.js' });

        await this.container.sentry.errors
            .send({
                username: this.container.client.user?.username,
                avatarURL: this.container.client.user?.avatarURL() || this.container.client.user?.defaultAvatarURL,
                content: `[${inlineCode(timestamp)}]: ${info}`,
                files: [errorDetails]
            })
            .catch((err) => console.log(err));
    }

    public override async run(error: Error | GraphQLResponseErrors) {
        if (process.env.DEV_DEPLOYMENT === 'true') {
            return console.log(error);
        }

        switch (true) {
            case error instanceof GraphQLResponseErrors:
                const { message, errors } = error as GraphQLResponseErrors;
                await this.sendWebhook(message, JSON.stringify(errors, null, 2));
                break;
            case error instanceof Error:
                await this.sendWebhook(error.message, error.stack);
                break;
        }
    }
}
