import type {
	GuildSettingsCache,
	GuildSettingsInsert,
	GuildSettingsRow,
	GuildSettingsUpdate,
	UserPointsCache,
	UserPointsInsert,
	UserPointsRow
} from '#lib/types/supabase';
import { container } from '@sapphire/pieces';

const DATABASE = container.database.client;
const CACHE = container.database.cache;

export async function getGuildSettings(serverId: string) {
	const CACHED = CACHE.guildSettings.get<GuildSettingsCache>(serverId);
	if (CACHED) return CACHED;

	let cacheData: GuildSettingsCache = {
		activity_roles: [],
		grantable_roles: [],
		points_system: false,
		welcome_card: false,
		welcome_channel: null,
		welcome_notifs: false,
		welcome_string: null
	};

	let { data, error } = await DATABASE.from('guild-settings').select('*').eq('server_id', serverId);
	if (!data || error) return null;

	if (!data.length) {
		let insert: GuildSettingsInsert = {
			activity_roles: [],
			grantable_roles: [],
			points_system: false,
			server_id: serverId,
			welcome_card: false,
			welcome_channel: null,
			welcome_notifs: false,
			welcome_string: null
		};

		let { error } = await DATABASE.from('guild-settings').insert<GuildSettingsInsert>(insert);
		if (error) return null;
	} else {
		let settings: Partial<GuildSettingsRow> = data[0];

		delete settings.id;
		delete settings.server_id;

		cacheData = Object.assign(cacheData, settings);
	}

	CACHE.guildSettings.set<GuildSettingsCache>(serverId, cacheData);
	return cacheData;
}

export async function updateGuildSettings(serverId: string, update: GuildSettingsUpdate) {
	const SETTINGS = await getGuildSettings(serverId);
	if (!SETTINGS) return;

	let { error } = await DATABASE.from('guild-settings').update<GuildSettingsUpdate>(update).eq('server_id', serverId);
	if (error) return false;

	CACHE.guildSettings.set<GuildSettingsCache>(serverId, Object.assign(SETTINGS, update));
	return true;
}

export async function getUserPoints(userId: string, serverId: string) {
	const CACHED = CACHE.userPoints.get<UserPointsRow>(`${serverId}.${userId}`);
	if (CACHED) return CACHED;

	let cacheData: UserPointsCache = {
		amount: 0,
		last_ran: 0
	};

	let { data, error } = await DATABASE.from('points').select('*').eq('server_id', serverId).eq('user_id', userId);
	if (!data || error) return null;

	if (!data.length) {
		let insert: UserPointsInsert = {
			amount: 0,
			last_ran: 0,
			server_id: serverId,
			user_id: userId
		};

		let { error } = await DATABASE.from('points').insert<UserPointsInsert>(insert);
		if (error) return null;
	} else {
		let points: Partial<UserPointsRow> = data[0];

		delete points.id;
		delete points.server_id;
		delete points.user_id;

		cacheData = Object.assign(cacheData, points);
	}

	CACHE.userPoints.set<UserPointsCache>(`${serverId}.${userId}`, cacheData);
	return cacheData;
}
