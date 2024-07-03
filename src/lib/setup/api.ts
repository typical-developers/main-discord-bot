import { BotGraphQLAPI } from '#lib/extensions/BotGraphQLAPI';
import { ExperienceGraphQLAPI } from '#lib/extensions/ExperienceGraphQLAPI';
import { container } from '@sapphire/pieces';

const { BOT_ENDPOINT_API_KEY, EXPERIENCE_ENDPOINT_API_SECRET } = process.env

container.api = {
    bot: new BotGraphQLAPI(BOT_ENDPOINT_API_KEY),
    experience: new ExperienceGraphQLAPI(EXPERIENCE_ENDPOINT_API_SECRET)
};
