import { SapphireClient, container } from '@sapphire/framework';
import { GatewayIntentBits, Partials, Options, ActivityType, Collection } from 'discord.js';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getRootData } from '@sapphire/pieces';
import { type Database } from '#lib/types/supabase';
import config from '../../env.json' assert { type: 'json' };

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
				GatewayIntentBits.MessageContent,
				GatewayIntentBits.GuildVoiceStates
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
			}),
			presence: {
				activities: [
					{
						type: ActivityType.Competing,
						name: 'being the worst bot ever made.'
					}
				]
			}
		});
	}

	public override async login(token: string) {
		container.database = {
			client: createClient(config.supabase.url, config.supabase.key),
			cache: {
				guildSettings: new Collection(),
				userPoints: new Collection(),
				voiceChannels: new Collection()
			}
		};

		return super.login(token);
	}

	public override async destroy(): Promise<void> {
		return super.destroy();
	}
}

declare module '@sapphire/pieces' {
	interface Container {
		database: {
			client: SupabaseClient<Database>;
			cache: {
				guildSettings: Collection<string, Database['public']['Tables']['guild-settings']['Row']>;
				userPoints: Collection<string, Collection<string, Database['public']['Tables']['points']['Row']>>;
				voiceChannels: Collection<string, Collection<string, Object>>;
			};
		};
	}
}
