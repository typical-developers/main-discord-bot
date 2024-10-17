import { BotGraphQLAPI } from '@/lib/extensions/BotGraphQLAPI';
import { container } from '@sapphire/pieces';

const { BOT_ENDPOINT_API_KEY } = process.env

container.api = {
    bot: new BotGraphQLAPI(BOT_ENDPOINT_API_KEY)
};
