export interface GuildSettingsRow {
	id: number;
	activity_roles: [number, string][] | never[];
	grantable_roles: string[] | never[];
	points_system: boolean;
	server_id: string;
	welcome_card: boolean;
	welcome_channel: string | null;
	welcome_notifs: boolean;
	welcome_string: string | null;
}

export interface GuildSettingsInsert {
	id?: number;
	activity_roles?: [number, string][] | never[];
	grantable_roles?: string[] | never[];
	points_system?: boolean;
	server_id: string;
	welcome_card?: boolean;
	welcome_channel?: string | null;
	welcome_notifs?: boolean;
	welcome_string?: string | null;
}

export interface GuildSettingsUpdate {
	id?: number;
	activity_roles?: [number, string][] | never[];
	grantable_roles?: string[] | never[];
	points_system?: boolean;
	server_id?: string;
	welcome_card?: boolean;
	welcome_channel?: string | null;
	welcome_notifs?: boolean;
	welcome_string?: string | null;
}

export interface GuildSettingsCache {
	activity_roles: [number, string][] | never[];
	grantable_roles: string[] | never[];
	points_system: boolean;
	welcome_card: boolean;
	welcome_channel: string | null;
	welcome_notifs: boolean;
	welcome_string: string | null;
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
