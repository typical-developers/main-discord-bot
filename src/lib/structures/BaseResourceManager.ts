import { Collection } from "discord.js";

export default abstract class BaseResourceManager<R = unknown> {
    public readonly cache = new Collection<string, R>();
}