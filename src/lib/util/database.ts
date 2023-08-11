import type { Database } from '#lib/types/supabase';
import { container } from '@sapphire/pieces';
import { Collection } from 'discord.js';

const DATABASE = container.database.client;
const CACHE = container.database.cache;

export async function getGuildSettings(serverId: string) {
	const CACHED = CACHE.guildSettings.get(serverId);

	if (CACHED) return CACHED;

	let insertData: Database['public']['Tables']['guild-settings']['Row'] = {
		activity_roles: [],
		grantable_roles: [],
		points_system: false,
		server_id: serverId,
		welcome_card: false,
		welcome_channel: null,
		welcome_notifs: false,
		welcome_string: null
	};

	let { data, error } = await DATABASE.from('guild-settings').select('*').eq('server_id', serverId);

	if (error) return null;
	if (!data?.length) {
		let { error } = await DATABASE.from('guild-settings').insert(insertData);
		if (error) return null;
	} else {
		(insertData.activity_roles = data[0].activity_roles),
			(insertData.grantable_roles = data[0].grantable_roles),
			(insertData.points_system = data[0].points_system),
			(insertData.welcome_card = data[0].welcome_card),
			(insertData.welcome_channel = data[0].welcome_channel),
			(insertData.welcome_notifs = data[0].welcome_notifs),
			(insertData.welcome_string = data[0].welcome_string);
	}

	CACHE.guildSettings.set(serverId, insertData);
	return insertData;
}

export async function updateGuildSettings(serverId: string, update: Database['public']['Tables']['guild-settings']['Update']) {
	const CURRENTSETTINGS = await getGuildSettings(serverId);
	if (!CURRENTSETTINGS) return;

	let { error } = await DATABASE.from('guild-settings').update(update).eq('server_id', serverId);

	if (error) return false;

	CACHE.guildSettings.set(serverId, Object.assign(CURRENTSETTINGS, update));

	return true;
}

export async function getUserPoints(userId: string, serverId: string) {
	let cachedServer = CACHE.userPoints.get(serverId);
	let cachedUser = cachedServer?.get(userId);

	if (!cachedServer) {
		CACHE.userPoints.set(serverId, new Collection());
		cachedServer = CACHE.userPoints.get(serverId);
	}

	if (cachedUser) return cachedUser;

	let insertData: Database['public']['Tables']['points']['Row'] = {
		amount: 0,
		last_ran: 0,
		server_id: serverId,
		user_id: userId
	};

	let { data, error } = await DATABASE.from('points').select('*').eq('server_id', serverId).eq('user_id', userId);

	if (error) return null;

	if (!data?.length) {
		let { error } = await DATABASE.from('points').insert(insertData);

		if (error) return null;
	} else {
		insertData.amount = data[0].amount;
		insertData.last_ran = data[0].last_ran;
	}

	cachedServer?.set(userId, insertData);
	return insertData;
}
