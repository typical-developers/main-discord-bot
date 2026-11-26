package commands

import (
	"errors"

	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/handler"
	"github.com/disgoorg/omit"
	"github.com/typical-developers/main-discord-bot/cmd/bot/handlers"
	"github.com/typical-developers/main-discord-bot/internal/database"
	"github.com/typical-developers/main-discord-bot/internal/disgox"
)

type chatActivityCommand struct {
	db *database.Database
}

func newChatActivityCommand(db *database.Database) *chatActivityCommand {
	return &chatActivityCommand{db}
}

func (c *chatActivityCommand) Create() discord.ApplicationCommandCreate {
	return discord.SlashCommandCreate{
		Name:                     "chat-activity",
		Description:              "Manage chat activity settings.",
		DefaultMemberPermissions: omit.NewPtr(discord.PermissionAdministrator),
		Contexts:                 guildOnly,
		Options: []discord.ApplicationCommandOption{
			discord.ApplicationCommandOptionSubCommand{
				Name:        "settings",
				Description: "Manage the chat activity defaults.",
				Options: []discord.ApplicationCommandOption{
					discord.ApplicationCommandOptionBool{
						Name:        "toggle",
						Description: "Toggle chat activity points granting on/off.",
					},
					discord.ApplicationCommandOptionInt{
						Name:        "cooldown",
						Description: "Set the duration between chat activity grants in seconds.",
					},
					discord.ApplicationCommandOptionInt{
						Name:        "amount",
						Description: "Set the total amount of chat points granted.",
					},
				},
			},
			discord.ApplicationCommandOptionSubCommandGroup{
				Name:        "role",
				Description: "Manage the roles that are granted for chat activity points.",
				Options: []discord.ApplicationCommandOptionSubCommand{
					{
						Name:        "add",
						Description: "Add a role to the list of roles that are granted for chat activity points.",
						Options: []discord.ApplicationCommandOption{
							discord.ApplicationCommandOptionRole{
								Name:        "role",
								Description: "The role to grant.",
								Required:    true,
							},
							discord.ApplicationCommandOptionInt{
								Name:        "required-points",
								Description: "The amount of chat points required to be granted the role.",
								Required:    true,
							},
						},
					},
				},
			},
		},
	}
}

func (c *chatActivityCommand) Register(r handler.Router) {
	r.Use(handlers.GuildOnly)
	r.SlashCommand("/settings", c.updateSettings)
	r.SlashCommand("/role/add", c.addRole)
}

func (c *chatActivityCommand) updateSettings(data discord.SlashCommandInteractionData, e *handler.CommandEvent) error {
	var opts database.UpdateActivitySettingsOpts

	if toggle, ok := data.OptBool("toggle"); ok {
		opts.IsEnabled = &toggle
	}

	if cooldown, ok := data.OptInt("cooldown"); ok {
		if cooldown < 0 {
			return disgox.UserErrorf("The cooldown cannot be negative.")
		}
		opts.GrantCooldown = new(int32(cooldown))
	}

	if amount, ok := data.OptInt("amount"); ok {
		if amount < 0 {
			return disgox.UserErrorf("The amount cannot be negative.")
		}
		opts.GrantAmount = new(int32(amount))
	}

	if opts.IsEnabled == nil && opts.GrantCooldown == nil && opts.GrantAmount == nil {
		return disgox.UserErrorf("Provide at least one setting to change.")
	}

	if err := e.DeferCreateMessage(true); err != nil {
		return err
	}

	if err := c.db.Guilds.UpdateActivitySettings(e.Ctx, *e.GuildID(), database.ActivityTypeChat, opts); err != nil {
		return err
	}

	_, err := e.CreateFollowupMessage(discord.MessageCreate{Content: "The chat activity settings have been updated."})
	return err
}

func (c *chatActivityCommand) addRole(data discord.SlashCommandInteractionData, e *handler.CommandEvent) error {
	role := data.Role("role")

	requiredPoints := data.Int("required-points")
	if requiredPoints < 0 {
		return disgox.UserErrorf("The required points cannot be negative.")
	}

	if err := e.DeferCreateMessage(true); err != nil {
		return err
	}

	if err := c.db.Guilds.CreateActivityRole(e.Ctx, *e.GuildID(), database.ActivityTypeChat, role.ID, int32(requiredPoints)); err != nil {
		if errors.Is(err, database.ErrActivityRoleExists) {
			return disgox.WrapUserError(err, "The activity role already exists.")
		}

		return err
	}

	_, err := e.CreateFollowupMessage(discord.MessageCreate{Content: "The activity role has been created."})
	return err
}
