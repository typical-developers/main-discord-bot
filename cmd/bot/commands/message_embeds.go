package commands

import (
	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/handler"
	"github.com/disgoorg/omit"
	"github.com/disgoorg/snowflake/v2"
	"github.com/typical-developers/main-discord-bot/cmd/bot/handlers"
	"github.com/typical-developers/main-discord-bot/internal/database"
)

type messageEmbedsCommand struct {
	db *database.Database
}

func newMessageEmbedsCommand(db *database.Database) *messageEmbedsCommand {
	return &messageEmbedsCommand{db}
}

func (c *messageEmbedsCommand) Create() discord.ApplicationCommandCreate {
	channelOption := discord.ApplicationCommandOptionChannel{
		Name:        "channel",
		Description: "The channel to add or remove.",
		Required:    true,
		ChannelTypes: []discord.ChannelType{
			discord.ChannelTypeGuildText,
			discord.ChannelTypeGuildNews,
			discord.ChannelTypeGuildVoice,
			discord.ChannelTypeGuildStageVoice,
		},
	}

	roleOption := discord.ApplicationCommandOptionRole{
		Name:        "role",
		Description: "The role to add or remove.",
		Required:    true,
	}

	addRemove := func(option discord.ApplicationCommandOption, noun string) []discord.ApplicationCommandOptionSubCommand {
		return []discord.ApplicationCommandOptionSubCommand{
			{
				Name:        "add",
				Description: "Add a " + noun + " to the list.",
				Options:     []discord.ApplicationCommandOption{option},
			},
			{
				Name:        "remove",
				Description: "Remove a " + noun + " from the list.",
				Options:     []discord.ApplicationCommandOption{option},
			},
		}
	}

	return discord.SlashCommandCreate{
		Name:                     "message-embeds",
		Description:              "Manage message embed settings.",
		DefaultMemberPermissions: omit.NewPtr(discord.PermissionAdministrator),
		Contexts:                 guildOnly,
		Options: []discord.ApplicationCommandOption{
			discord.ApplicationCommandOptionSubCommand{
				Name:        "settings",
				Description: "Manage the message embed settings.",
				Options: []discord.ApplicationCommandOption{
					discord.ApplicationCommandOptionBool{
						Name:        "toggle",
						Description: "Toggle message embeds on/off.",
						Required:    true,
					},
				},
			},
			discord.ApplicationCommandOptionSubCommandGroup{
				Name:        "disabled-channels",
				Description: "Channels where message links are not embedded.",
				Options:     addRemove(channelOption, "channel"),
			},
			discord.ApplicationCommandOptionSubCommandGroup{
				Name:        "ignored-channels",
				Description: "Channels whose messages are never embedded when linked.",
				Options:     addRemove(channelOption, "channel"),
			},
			discord.ApplicationCommandOptionSubCommandGroup{
				Name:        "ignored-roles",
				Description: "Roles whose members' message links are not embedded.",
				Options:     addRemove(roleOption, "role"),
			},
		},
	}
}

func (c *messageEmbedsCommand) Register(r handler.Router) {
	r.Use(handlers.GuildOnly)

	r.SlashCommand("/settings", func(data discord.SlashCommandInteractionData, e *handler.CommandEvent) error {
		return c.update(e, database.UpdateMessageEmbedSettingsOpts{IsEnabled: new(data.Bool("toggle"))})
	})

	r.SlashCommand("/disabled-channels/add", c.withChannel(func(id *snowflake.ID) database.UpdateMessageEmbedSettingsOpts {
		return database.UpdateMessageEmbedSettingsOpts{AddDisabledChannel: id}
	}))
	r.SlashCommand("/disabled-channels/remove", c.withChannel(func(id *snowflake.ID) database.UpdateMessageEmbedSettingsOpts {
		return database.UpdateMessageEmbedSettingsOpts{RemoveDisabledChannel: id}
	}))

	r.SlashCommand("/ignored-channels/add", c.withChannel(func(id *snowflake.ID) database.UpdateMessageEmbedSettingsOpts {
		return database.UpdateMessageEmbedSettingsOpts{AddIgnoredChannel: id}
	}))
	r.SlashCommand("/ignored-channels/remove", c.withChannel(func(id *snowflake.ID) database.UpdateMessageEmbedSettingsOpts {
		return database.UpdateMessageEmbedSettingsOpts{RemoveIgnoredChannel: id}
	}))

	r.SlashCommand("/ignored-roles/add", c.withRole(func(id *snowflake.ID) database.UpdateMessageEmbedSettingsOpts {
		return database.UpdateMessageEmbedSettingsOpts{AddIgnoredRole: id}
	}))
	r.SlashCommand("/ignored-roles/remove", c.withRole(func(id *snowflake.ID) database.UpdateMessageEmbedSettingsOpts {
		return database.UpdateMessageEmbedSettingsOpts{RemoveIgnoredRole: id}
	}))
}

// withChannel builds a handler that applies the "channel" option to the settings.
func (c *messageEmbedsCommand) withChannel(opts func(id *snowflake.ID) database.UpdateMessageEmbedSettingsOpts) handler.SlashCommandHandler {
	return func(data discord.SlashCommandInteractionData, e *handler.CommandEvent) error {
		return c.update(e, opts(new(data.Snowflake("channel"))))
	}
}

// withRole builds a handler that applies the "role" option to the settings.
func (c *messageEmbedsCommand) withRole(opts func(id *snowflake.ID) database.UpdateMessageEmbedSettingsOpts) handler.SlashCommandHandler {
	return func(data discord.SlashCommandInteractionData, e *handler.CommandEvent) error {
		return c.update(e, opts(new(data.Role("role").ID)))
	}
}

func (c *messageEmbedsCommand) update(e *handler.CommandEvent, opts database.UpdateMessageEmbedSettingsOpts) error {
	if err := e.DeferCreateMessage(true); err != nil {
		return err
	}

	if err := c.db.Guilds.UpdateMessageEmbedSettings(e.Ctx, *e.GuildID(), opts); err != nil {
		return err
	}

	_, err := e.CreateFollowupMessage(discord.MessageCreate{Content: "The message embed settings have been updated."})
	return err
}
