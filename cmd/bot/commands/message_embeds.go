package commands

import (
	"fmt"
	"strings"

	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/handler"
	"github.com/disgoorg/omit"
	"github.com/disgoorg/snowflake/v2"
	"github.com/typical-developers/main-discord-bot/cmd/bot/handlers"
	"github.com/typical-developers/main-discord-bot/internal/database"
	"github.com/typical-developers/main-discord-bot/internal/disgox"
)

const (
	messageEmbedsSettingsID = "/message-embeds/settings"

	embedsEnabledInput          = "enabled"
	embedsDisabledChannelsInput = "disabled_channels"
	embedsIgnoredChannelsInput  = "ignored_channels"
	embedsIgnoredRolesInput     = "ignored_roles"
)

// messageEmbedChannelTypes are the channels message embeds can be turned off in.
var messageEmbedChannelTypes = []discord.ChannelType{
	discord.ChannelTypeGuildText,
	discord.ChannelTypeGuildNews,
	discord.ChannelTypeGuildVoice,
	discord.ChannelTypeGuildStageVoice,
}

type messageEmbedsCommand struct {
	db *database.Database
}

func newMessageEmbedsCommand(db *database.Database) *messageEmbedsCommand {
	return &messageEmbedsCommand{db}
}

func (c *messageEmbedsCommand) Create() discord.ApplicationCommandCreate {
	return discord.SlashCommandCreate{
		Name:                     "message-embeds",
		Description:              "Manage message embed settings.",
		DefaultMemberPermissions: omit.NewPtr(discord.PermissionAdministrator),
		Contexts:                 guildOnly,
		Options: []discord.ApplicationCommandOption{
			discord.ApplicationCommandOptionSubCommand{
				Name:        "settings",
				Description: "View and change the message embed settings.",
			},
		},
	}
}

func (c *messageEmbedsCommand) Register(r handler.Router) {
	r.Use(handlers.GuildOnly)
	r.SlashCommand("/settings", c.openSettings)

	r.Group(func(r handler.Router) {
		// Discord only gates the command itself, so the modal is checked here too.
		r.Use(handlers.RequirePermissions(discord.PermissionAdministrator))
		r.Modal("/settings", c.saveSettings)
	})
}

// openSettings opens the settings modal, filled in with the current settings.
func (c *messageEmbedsCommand) openSettings(_ discord.SlashCommandInteractionData, e *handler.CommandEvent) error {
	settings, err := c.db.Guilds.GetMessageEmbedSettings(e.Ctx, *e.GuildID())
	if err != nil {
		return err
	}

	for _, list := range [][]snowflake.ID{settings.DisabledChannels, settings.IgnoredChannels, settings.IgnoredRoles} {
		if len(list) > maxSelectValues {
			return disgox.UserErrorf("One of the message embed lists has more than %d entries, which is more than the settings window can show.", maxSelectValues)
		}
	}

	channelSelect := func(customID string, selected []snowflake.ID) discord.ChannelSelectMenuComponent {
		return discord.NewChannelSelectMenu(customID, "None").
			WithChannelTypes(messageEmbedChannelTypes...).
			WithMinValues(0).
			WithMaxValues(maxSelectValues).
			WithRequired(false).
			SetDefaultValues(selected...)
	}

	modal := discord.NewModalCreate(messageEmbedsSettingsID, "Message Embed Settings").
		AddComponents(
			discord.NewLabel("Enabled", discord.CheckboxComponent{CustomID: embedsEnabledInput, Default: settings.IsEnabled}).
				WithDescription("Embed the messages that message links point to."),
			discord.NewLabel("Disabled Channels", channelSelect(embedsDisabledChannelsInput, settings.DisabledChannels)).
				WithDescription("Message links sent in these channels are not embedded."),
			discord.NewLabel("Ignored Channels", channelSelect(embedsIgnoredChannelsInput, settings.IgnoredChannels)).
				WithDescription("Messages from these channels are never embedded when linked."),
			discord.NewLabel("Ignored Roles",
				discord.NewRoleSelectMenu(embedsIgnoredRolesInput, "None").
					WithMinValues(0).
					WithMaxValues(maxSelectValues).
					WithRequired(false).
					SetDefaultValues(settings.IgnoredRoles...),
			).WithDescription("Message links sent by members with these roles are not embedded."),
		)

	return e.Modal(modal)
}

// saveSettings saves everything in the settings modal.
func (c *messageEmbedsCommand) saveSettings(e *handler.ModalEvent) error {
	settings := database.MessageEmbedSettings{
		IsEnabled:        modalCheckbox(e.Data, embedsEnabledInput),
		DisabledChannels: modalChannelIDs(e.Data, embedsDisabledChannelsInput),
		IgnoredChannels:  modalChannelIDs(e.Data, embedsIgnoredChannelsInput),
		IgnoredRoles:     modalRoleIDs(e.Data, embedsIgnoredRolesInput),
	}

	if err := e.DeferCreateMessage(true); err != nil {
		return err
	}

	if err := c.db.Guilds.SetMessageEmbedSettings(e.Ctx, *e.GuildID(), settings); err != nil {
		return err
	}

	state := "Disabled"
	if settings.IsEnabled {
		state = "Enabled"
	}

	_, err := e.CreateFollowupMessage(discord.MessageCreate{
		Content: fmt.Sprintf(
			"The message embed settings have been updated.\n"+
				"**Message Embeds:** %s\n**Disabled Channels:** %s\n**Ignored Channels:** %s\n**Ignored Roles:** %s",
			state,
			mentionList(settings.DisabledChannels, "<#%s>"),
			mentionList(settings.IgnoredChannels, "<#%s>"),
			mentionList(settings.IgnoredRoles, "<@&%s>"),
		),
		AllowedMentions: &discord.AllowedMentions{},
	})
	return err
}

// mentionList formats IDs as a comma separated list of mentions, using a format like "<#%s>".
func mentionList(ids []snowflake.ID, format string) string {
	if len(ids) == 0 {
		return "None"
	}

	mentions := make([]string, len(ids))
	for i, id := range ids {
		mentions[i] = fmt.Sprintf(format, id)
	}

	return strings.Join(mentions, ", ")
}
