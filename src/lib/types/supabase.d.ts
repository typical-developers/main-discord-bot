export interface GuildSettingsRow {
	id: number;
	activity_roles: [number, string][];
	grantable_roles: string[];
	points_system: boolean;
	server_id: string;
}

export interface GuildSettingsInsert {
	id?: number;
	activity_roles?: [number, string][];
	grantable_roles?: string[];
	points_system?: boolean;
	server_id: string;
}

export interface GuildSettingsUpdate {
	id?: number;
	activity_roles?: [number, string][];
	grantable_roles?: string[];
	points_system?: boolean;
	server_id?: string;
}

export interface GuildSettingsCache {
	activity_roles: [number, string][];
	grantable_roles: string[];
	points_system: boolean;
}

export interface UserPointsRow {
	id: number;
	amount: number;
	last_ran: number;
	server_id: string;
	user_id: string;
}

export interface UserPointsInsert {
	id?: number;
	amount: number;
	last_ran: number;
	server_id: string;
	user_id: string;
}

export interface UserPointsUpdate {
	id?: number;
	amount: number;
	last_ran: number;
	server_id?: string;
	user_id?: string;
}

export interface UserPointsCache {
	amount: number;
	last_ran: number;
}
