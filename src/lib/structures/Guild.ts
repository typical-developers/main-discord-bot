import ChatActivitySettings, { type GuildChatActivityTracking } from './ChatActivitySettings';
import MessageEmbedSettings, { type GuildMessageEmbeds, type GuildMessageEmbedsUpdateOptions } from './MessageEmbedSettings';
import VoiceRoomLobby, { type GuildVoiceRoomLobby, type GuildVoiceRoomLobbyOptions } from './VoiceRoomLobby';
import GuildMemberResourceManager from './GuildMemberResourceManager';
import ActiveVoiceRoomResourceMananger from './ActiveVoiceRoomResourceMananger';
import { VoiceRoomLobbyResourceManager } from './VoiceRoomLobbyResourceManager';
import GuildActivityLeaderboard, { type GuildActivityLeaderboardQueryOptions } from './GuildActivityLeaderboard';

import { Collection } from 'discord.js';
import { okAsync, errAsync } from 'neverthrow';
import type { APIResponse, APIError } from '#/lib/types/api';
import { request } from '#/lib/util/request';
import RequestError from '#/lib/extensions/RequestError';

const { BOT_API_URL, BOT_ENDPOINT_API_KEY, BROWSERLESS_URL } = process.env;

export type GuildSettings = {
    chat_activity: GuildChatActivityTracking;
    message_embeds: GuildMessageEmbeds;
    voice_room_lobbies: Array<GuildVoiceRoomLobby>;
};

export default class Guild {
    /** The id of the guild. */
    public readonly id: string;

    /** The members of the guild. */
    public readonly members: GuildMemberResourceManager;

    /** The chat activity settings for the guild. */
    public chatActivity: ChatActivitySettings;
    /** The message embed settings for the guild. */
    public messageEmbeds: MessageEmbedSettings;
    /** The voice rooms for the guild. */
    public activeVoiceRooms: ActiveVoiceRoomResourceMananger;
    /** The voice room lobbies for the guild. */
    public voiceRoomLobbies: VoiceRoomLobbyResourceManager;

    constructor(id: string, { chat_activity, message_embeds, voice_room_lobbies }: GuildSettings) {
        this.id = id;
        this.members = new GuildMemberResourceManager(this);
        this.chatActivity = new ChatActivitySettings(this, chat_activity);
        this.messageEmbeds = new MessageEmbedSettings(this, message_embeds);

        this.activeVoiceRooms = new ActiveVoiceRoomResourceMananger(this);

        this.voiceRoomLobbies = new VoiceRoomLobbyResourceManager(this);
        for (const lobby of voice_room_lobbies) {
            this.voiceRoomLobbies.cache.set(lobby.channel_id, new VoiceRoomLobby(this, lobby));
        }
    }

    /**
     * Generates a leaderboard card for the guild.
     * @deprecated use {@link getActivityLeaderboard} instead.
     */
    public async generateActivityLeaderboardCard({ activity_type, time_period }: Omit<GuildActivityLeaderboardQueryOptions, 'page'>) {
        const browserlessUrl = new URL("/screenshot", BROWSERLESS_URL);
        
        const url = new URL(`/v1/guild/${this.id}/activity-leaderboard-card`, BOT_API_URL);
        const params = new URLSearchParams({ activity_type: activity_type, time_period: time_period });
        url.search = params.toString();

        const data = {
            url: url.toString(),
            selector: "body",

            setExtraHTTPHeaders: {
                Authorization: BOT_ENDPOINT_API_KEY,
            },

            gotoOptions: {
                waitUntil: "networkidle0",
            },

            options: {
                type: "png",
                fullPage: false,
                omitBackground: true,
            },
        };

        try {
            const res = await fetch(browserlessUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                return errAsync(new RequestError({
                    message: `Request failed with status code ${res.status}.`,
                    response: res,
                    payload: {}
                }));
            }

            const responseCode = res.headers.get("X-Response-Code");
            if (responseCode) {
                const code = parseInt(responseCode);
                const responseText = res.headers.get("X-Response-Text")!;

                /**
                 * We create a new response so the error knows what actually happened.
                 */
                const clonedRes = res.clone();
                const modifiedRes = new Response(clonedRes.body, {
                    status: code,
                    statusText: responseText,
                    headers: res.headers
                })

                if (code <= 199 || code >= 300) {
                    return errAsync(new RequestError({
                        message: `Request failed with status code ${code}.`,
                        response: modifiedRes,
                        payload: {}
                    }));
                }
            }

            return okAsync(Buffer.from(await res.arrayBuffer()));
        } catch (e) {
            return errAsync(e);
        }
    }

    public async getActivityLeaderboard(options: GuildActivityLeaderboardQueryOptions) {
        return GuildActivityLeaderboard.get(this, options);
    }

    /**
     * Updates the configuration for message embeds.
     */
    public async updateMessageEmbedSettings(options: GuildMessageEmbedsUpdateOptions) {
        const res = await request<APIResponse<GuildSettings>, APIError>({
            url: new URL(`/v1/guild/${this.id}/settings/message-embeds`, BOT_API_URL),
            method: 'PATCH',
            headers: {
                Authorization: BOT_ENDPOINT_API_KEY
            },
            body: options
        });

        if (res.isErr()) return errAsync(res.error);

        const { message_embeds } = res.value.data;
        this.messageEmbeds = new MessageEmbedSettings(this, message_embeds);

        return okAsync(this);
    }
}