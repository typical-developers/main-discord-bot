import type Guild from "./Guild";
import type { GuildVoiceRoomLobby } from "./VoiceRoomLobby";

export type GuildActiveVoiceRoom = {
    origin_channel_id: string;
    creator_id: string;
    current_owner_id: string;
    is_locked: boolean;

    settings: Omit<GuildVoiceRoomLobby, 'opened_rooms'>;
};

export type GuildActiveVoiceRoomRegisterOptions = {
    channel_id: string;
    creator_id: string;
};

export type GuildActiveVoiceRoomUpdateOptions = Partial<Omit<GuildActiveVoiceRoom, 'origin_channel_id' | 'creator_id' | 'settings'>>;

export default class VoiceRoom {
    public readonly id: string;
    public readonly guild: Guild;

    public readonly originChannelId: string;
    public readonly creatorId: string;

    public currentOwnerId: string;
    public isLocked: boolean;

    constructor(id: string, guild: Guild, { origin_channel_id, creator_id, current_owner_id, is_locked }: GuildActiveVoiceRoom) {
        this.id = id;
        this.guild = guild;

        this.originChannelId = origin_channel_id;
        this.creatorId = creator_id;

        this.currentOwnerId = current_owner_id;
        this.isLocked = is_locked;
    }

    public get creatorIsOwner() {
        return this.creatorId === this.currentOwnerId;
    }

    public isOwner(userId: string) {
        return this.currentOwnerId === userId;
    }

    public isCreator(userId: string) {
        return this.creatorId === userId;
    }

    public async settings() {
        return this.guild.voiceRoomLobbies.get(this.originChannelId);
    }

    public async update(options: GuildActiveVoiceRoomUpdateOptions) {
        return this.guild.activeVoiceRooms.update(this.id, options);
    }

    public async delete() {
        return this.guild.activeVoiceRooms.delete(this.id);
    }
}