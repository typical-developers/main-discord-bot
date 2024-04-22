import { TypicalAPI } from '#lib/structures/API';
import { container } from '@sapphire/pieces';

container.api = new TypicalAPI(process.env.BOT_ENDPOINT_API_KEY);
