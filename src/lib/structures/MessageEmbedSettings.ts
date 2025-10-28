import type Guild from "./Guild";

export type GuildMessageEmbeds = {
    is_enabled: boolean;
    disabled_channels: Array<string>;
    ignored_channels: Array<string>;
    ignored_roles: Array<string>;
};

export type GuildMessageEmbedsUpdateOptions = Partial<Omit<GuildMessageEmbeds, 'disabled_channels' | 'ignored_channels' | 'ignored_roles'>> & {
    add_disabled_channel?: string;
    remove_disabled_channel?: string;
    add_ignored_channel?: string;
    remove_ignored_channel?: string;
    add_ignored_role?: string;
    remove_ignored_role?: string;
};

export default class MessageEmbedSettings {
    public readonly guild: Guild
    public isEnabled: boolean;
    public disabledChannels: Array<string>;
    public ignoredChannels: Array<string>;
    public ignoredRoles: Array<string>;

    constructor(guild: Guild, { is_enabled, disabled_channels, ignored_channels, ignored_roles }: GuildMessageEmbeds) {
        this.guild = guild;

        this.isEnabled = is_enabled;
        this.disabledChannels = disabled_channels;
        this.ignoredChannels = ignored_channels;
        this.ignoredRoles = ignored_roles;
    }
}