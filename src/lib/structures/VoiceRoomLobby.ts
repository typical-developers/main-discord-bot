import type Guild from "./Guild";
import type { GuildActiveVoiceRoomRegisterOptions } from "./VoiceRoom";

export type GuildVoiceRoomLobby = {
    channel_id: string;
    user_limit: number;
    can_rename: boolean;
    can_lock: boolean;
    can_adjust_limit: boolean;

    opened_rooms: Array<string>;
};

export type GuildVoiceRoomLobbyOptions = Partial<Omit<GuildVoiceRoomLobby, 'opened_rooms'>>;

export default class VoiceRoomLobby {
    public readonly id: string;
    public readonly guild: Guild;

    public userLimit: number;
    public canRename: boolean;
    public canLock: boolean;
    public canAdjustLimit: boolean;

    public openedRooms: Array<string>;

    constructor(guild: Guild, { channel_id, user_limit, can_rename, can_lock, can_adjust_limit, opened_rooms }: GuildVoiceRoomLobby) {
        this.id = channel_id;
        this.guild = guild;

        this.userLimit = user_limit;
        this.canRename = can_rename;
        this.canLock = can_lock;
        this.canAdjustLimit = can_adjust_limit;

        this.openedRooms = opened_rooms;
    }

    public async register(options: GuildActiveVoiceRoomRegisterOptions) {
        return this.guild.activeVoiceRooms.register(this.id, options);
    }
}