import { SapphireClient, container } from '@sapphire/framework';
import { GatewayIntentBits, Partials, Options } from 'discord.js';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getRootData } from '@sapphire/pieces';
import config from '../../env.json' assert { type: 'json' };
import NodeCache from 'node-cache';

export default class TypicalClient extends SapphireClient {
	readonly rootData = getRootData();

	public constructor() {
		super({
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.GuildMessageReactions,
				GatewayIntentBits.GuildMembers,
				GatewayIntentBits.GuildPresences,
				GatewayIntentBits.DirectMessages,
				GatewayIntentBits.MessageContent
			],
			partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
			sweepers: {
				...Options.DefaultSweeperSettings,
				messages: {
					interval: 1800,
					lifetime: 900
				}
			},
			makeCache: Options.cacheWithLimits({
				...Options.DefaultMakeCacheSettings,
				AutoModerationRuleManager: 0,
				BaseGuildEmojiManager: 0,
				GuildEmojiManager: 0,
				GuildBanManager: 0,
				GuildInviteManager: 0,
				ReactionManager: 0,
				ReactionUserManager: 0,
				StageInstanceManager: 0,
				VoiceStateManager: 0,
				GuildMemberManager: {
					maxSize: 50
				}
			})
		});
	}

	public override async login(token: string) {
		container.database = {
			client: createClient(config.supabase.url, config.supabase.key),
			cache: {
				guildSettings: new NodeCache(),
				userPoints: new NodeCache({ stdTTL: 1800, checkperiod: 600 })
			}
		};

		container.failedReports = {
			cache: {
				issueReports: new NodeCache({ stdTTL: 600, checkperiod: 300 })
			}
		};

		return await super.login(token);
	}

	public override async destroy(): Promise<void> {
		return await super.destroy();
	}
}

declare module '@sapphire/pieces' {
	interface Container {
		database: {
			client: SupabaseClient;
			cache: {
				[key: string]: NodeCache;
			};
		};
		failedReports: {
			cache: {
				[key: string]: NodeCache;
			};
		};
	}
}

declare module '@sapphire/framework' {
	interface Preconditions {
		OwnerOnly: never;
	}
}
