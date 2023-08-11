import TypicalClient from './lib/extensions/TypicalClient.js';
import config from './env.json' assert { type: 'json' };
import { ApplicationCommandRegistries, RegisterBehavior } from '@sapphire/framework';

const CLIENT = new TypicalClient();

try {
	CLIENT.logger.info('Logging into client.');
	await CLIENT.login(config.token);
	CLIENT.logger.info('Logged into client.');

	ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(RegisterBehavior.BulkOverwrite);
} catch (err) {
	CLIENT.logger.fatal(err);
	CLIENT.destroy();
}
