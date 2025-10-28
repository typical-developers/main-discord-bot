import GuildResourceManager from "./GuildResourceManager";

export default class BotAPI {
    public readonly guilds = new GuildResourceManager();
}