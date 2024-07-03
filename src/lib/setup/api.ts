import { BotGraphQLAPI } from '#lib/extensions/BotGraphQLAPI';
import { container } from '@sapphire/pieces';

container.api = {
    bot: new BotGraphQLAPI(process.env.BOT_ENDPOINT_API_KEY)
};
