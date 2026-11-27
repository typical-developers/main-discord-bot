package commands

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/disgoorg/disgo/bot"
	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/handler"
	"github.com/disgoorg/omit"
	"github.com/disgoorg/snowflake/v2"
	"github.com/typical-developers/main-discord-bot/cmd/bot/handlers"
	"github.com/typical-developers/main-discord-bot/internal/database"
	"github.com/typical-developers/main-discord-bot/internal/database/gen"
	"github.com/typical-developers/main-discord-bot/internal/disgox"
	"github.com/typical-developers/main-discord-bot/internal/ptr"
)

const (
	chatActivitySettingsID   = "/chat-activity/settings"
	chatActivityAddRoleID    = "/chat-activity/roles/add"
	chatActivityEditRoleID   = "/chat-activity/roles/edit"
	chatActivityRemoveRoleID = "/chat-activity/roles/remove"

	activityEnabledInput        = "enabled"
	activityCooldownInput       = "cooldown"
	activityAmountInput         = "amount"
	activityDenyRolesInput      = "deny_roles"
	activityRoleInput           = "role"
	activityRequiredPointsInput = "required_points"
	activityRemoveRolesInput    = "roles"
	activityEditRoleInput       = "role"
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
				Description: "View and change the chat activity settings.",
			},
			discord.ApplicationCommandOptionSubCommand{
				Name:        "roles",
				Description: "View, add, edit and remove the roles that are granted for chat activity points.",
			},
		},
	}
}

func (c *chatActivityCommand) Register(r handler.Router) {
	r.Use(handlers.GuildOnly)
	r.SlashCommand("/settings", c.openSettings)
	r.SlashCommand("/roles", c.roles)

	r.Group(func(r handler.Router) {
		// Discord only gates the command itself, so the buttons and modals are checked here too.
		r.Use(handlers.RequirePermissions(discord.PermissionAdministrator))

		r.Modal("/settings", c.saveSettings)

		r.ButtonComponent("/roles/add", c.openAddRole)
		r.Modal("/roles/add", c.addRole)

		r.ButtonComponent("/roles/edit", c.openEditRole)
		r.Modal("/roles/edit", c.editRole)

		r.ButtonComponent("/roles/remove", c.openRemoveRoles)
		r.Modal("/roles/remove", c.removeRoles)
	})
}

// openSettings opens the settings modal, filled in with the current settings.
func (c *chatActivityCommand) openSettings(_ discord.SlashCommandInteractionData, e *handler.CommandEvent) error {
	settings, err := c.db.Guilds.GetActivitySettings(e.Ctx, *e.GuildID(), database.ActivityTypeChat)
	if err != nil {
		return err
	}

	if len(settings.DenyRoles) > maxSelectValues {
		return disgox.UserErrorf("There are more than %d denied roles, which is more than the settings window can show.", maxSelectValues)
	}

	modal := discord.NewModalCreate(chatActivitySettingsID, "Chat Activity Settings").
		AddComponents(
			discord.NewLabel("Enabled", discord.CheckboxComponent{CustomID: activityEnabledInput, Default: settings.IsEnabled}).
				WithDescription("Grant chat activity points to members for sending messages."),
			discord.NewLabel("Cooldown",
				discord.NewShortTextInput(activityCooldownInput).
					WithValue(fmt.Sprint(settings.GrantCooldown)).
					WithPlaceholder("In seconds, e.g. 60").
					WithMaxLength(10).
					WithRequired(true),
			).WithDescription("Seconds a member has to wait between chat activity grants."),
			discord.NewLabel("Points Per Grant",
				discord.NewShortTextInput(activityAmountInput).
					WithValue(fmt.Sprint(settings.GrantAmount)).
					WithMaxLength(10).
					WithRequired(true),
			).WithDescription("How many chat activity points are granted each time."),
			discord.NewLabel("Denied Roles",
				discord.NewRoleSelectMenu(activityDenyRolesInput, "None").
					WithMinValues(0).
					WithMaxValues(maxSelectValues).
					WithRequired(false).
					SetDefaultValues(settings.DenyRoles...),
			).WithDescription("Members with any of these roles don't earn chat activity points."),
		)

	return e.Modal(modal)
}

// saveSettings saves everything in the settings modal.
func (c *chatActivityCommand) saveSettings(e *handler.ModalEvent) error {
	cooldown, err := modalInt(e.Data, activityCooldownInput, "cooldown", 0, math.MaxInt32)
	if err != nil {
		return err
	}

	amount, err := modalInt(e.Data, activityAmountInput, "points per grant", 0, math.MaxInt32)
	if err != nil {
		return err
	}

	enabled := modalCheckbox(e.Data, activityEnabledInput)
	denyRoles := modalRoleIDs(e.Data, activityDenyRolesInput)

	if err := e.DeferCreateMessage(true); err != nil {
		return err
	}

	if err := c.db.Guilds.UpdateActivitySettings(e.Ctx, *e.GuildID(), database.ActivityTypeChat, database.UpdateActivitySettingsOpts{
		IsEnabled:     &enabled,
		GrantCooldown: new(int32(cooldown)),
		GrantAmount:   new(int32(amount)),
		DenyRoles:     denyRoles,
	}); err != nil {
		return err
	}

	state := "Disabled"
	if enabled {
		state = "Enabled"
	}

	_, err = e.CreateFollowupMessage(discord.MessageCreate{
		Content: fmt.Sprintf(
			"The chat activity settings have been updated.\n"+
				"**Chat Activity:** %s\n**Cooldown:** %d seconds\n**Points Per Grant:** %d\n**Denied Roles:** %s",
			state, cooldown, amount, mentionList(denyRoles, "<@&%s>"),
		),
		AllowedMentions: &discord.AllowedMentions{},
	})
	return err
}

// roles replies with the activity roles card.
func (c *chatActivityCommand) roles(_ discord.SlashCommandInteractionData, e *handler.CommandEvent) error {
	card, err := c.rolesCard(e.Ctx, *e.GuildID())
	if err != nil {
		return err
	}

	return e.CreateMessage(discord.MessageCreate{
		Flags:           discord.MessageFlagEphemeral | discord.MessageFlagIsComponentsV2,
		Components:      []discord.LayoutComponent{card},
		AllowedMentions: &discord.AllowedMentions{},
	})
}

// rolesCard lists the guild's chat activity roles, with buttons to add and remove them.
// It must be sent with discord.MessageFlagIsComponentsV2.
func (c *chatActivityCommand) rolesCard(ctx context.Context, guildID snowflake.ID) (discord.ContainerComponent, error) {
	roles, err := c.db.Guilds.GetActivityRoles(ctx, guildID, database.ActivityTypeChat)
	if err != nil {
		return discord.ContainerComponent{}, err
	}

	list := "There are no chat activity roles yet."
	if len(roles) > 0 {
		lines := make([]string, len(roles))
		for i, role := range roles {
			lines[i] = fmt.Sprintf("- <@&%s>: `%d` points", role.RoleID, ptr.Value(role.RequiredPoints))
		}
		list = strings.Join(lines, "\n")
	}

	return discord.NewContainer(
		discord.NewTextDisplay("### Chat Activity Roles"),
		discord.NewTextDisplay(list),
		discord.NewActionRow(
			discord.NewPrimaryButton("Add Role", chatActivityAddRoleID),
			discord.NewSecondaryButton("Edit Role", chatActivityEditRoleID).WithDisabled(len(roles) == 0),
			discord.NewSecondaryButton("Remove Roles", chatActivityRemoveRoleID).WithDisabled(len(roles) == 0),
		),
	), nil
}

// refreshRolesCard replaces the activity roles card the modal was opened from.
// The interaction must already be deferred with DeferUpdateMessage.
func (c *chatActivityCommand) refreshRolesCard(e *handler.ModalEvent) error {
	card, err := c.rolesCard(e.Ctx, *e.GuildID())
	if err != nil {
		return err
	}

	_, err = e.UpdateInteractionResponse(discord.NewMessageUpdate().
		WithIsComponentsV2(true).
		WithComponents(card).
		WithAllowedMentions(&discord.AllowedMentions{}),
	)
	return err
}

func (c *chatActivityCommand) openAddRole(_ discord.ButtonInteractionData, e *handler.ComponentEvent) error {
	modal := discord.NewModalCreate(chatActivityAddRoleID, "Add Chat Activity Role").
		AddComponents(
			discord.NewLabel("Role",
				discord.NewRoleSelectMenu(activityRoleInput, "Pick a role").
					WithMaxValues(1).
					WithRequired(true),
			).WithDescription("The role to give members."),
			discord.NewLabel("Required Points",
				discord.NewShortTextInput(activityRequiredPointsInput).
					WithPlaceholder("e.g. 500").
					WithMaxLength(10).
					WithRequired(true),
			).WithDescription("How many chat activity points members need to be given the role."),
		)

	return e.Modal(modal)
}

func (c *chatActivityCommand) addRole(e *handler.ModalEvent) error {
	guildID := *e.GuildID()

	roles := e.Data.Roles(activityRoleInput)
	if len(roles) != 1 {
		return disgox.UserErrorf("Pick a role to add.")
	}
	role := roles[0]

	if role.ID == guildID {
		return disgox.UserErrorf("The @everyone role cannot be an activity role.")
	}
	if role.Managed {
		return disgox.UserErrorf("<@&%s> is managed by an integration, so it cannot be given to members.", role.ID)
	}

	requiredPoints, err := modalInt(e.Data, activityRequiredPointsInput, "required points", 0, math.MaxInt32)
	if err != nil {
		return err
	}

	if err := e.DeferUpdateMessage(); err != nil {
		return err
	}

	if err := c.db.Guilds.CreateActivityRole(e.Ctx, guildID, database.ActivityTypeChat, role.ID, int32(requiredPoints)); err != nil {
		if errors.Is(err, database.ErrActivityRoleExists) {
			return disgox.WrapUserError(err, fmt.Sprintf("<@&%s> is already an activity role.", role.ID))
		}

		return err
	}

	return c.refreshRolesCard(e)
}

func (c *chatActivityCommand) openEditRole(_ discord.ButtonInteractionData, e *handler.ComponentEvent) error {
	roles, err := c.db.Guilds.GetActivityRoles(e.Ctx, *e.GuildID(), database.ActivityTypeChat)
	if err != nil {
		return err
	}

	if len(roles) == 0 {
		return disgox.UserErrorf("There are no chat activity roles to edit.")
	}

	modal := discord.NewModalCreate(chatActivityEditRoleID, "Edit Chat Activity Role").
		AddComponents(
			discord.NewLabel("Role",
				discord.NewStringSelectMenu(activityEditRoleInput, "Pick the role to edit", activityRoleOptions(e.Client(), *e.GuildID(), roles)...).
					WithMaxValues(1).
					WithRequired(true),
			).WithDescription("The current required points are shown under each role."),
			discord.NewLabel("Required Points",
				discord.NewShortTextInput(activityRequiredPointsInput).
					WithPlaceholder("e.g. 500").
					WithMaxLength(10).
					WithRequired(true),
			).WithDescription("The new amount of chat activity points needed for the role."),
		)

	return e.Modal(modal)
}

func (c *chatActivityCommand) editRole(e *handler.ModalEvent) error {
	values := e.Data.StringValues(activityEditRoleInput)
	if len(values) != 1 {
		return disgox.UserErrorf("Pick a role to edit.")
	}

	roleID, err := snowflake.Parse(values[0])
	if err != nil {
		return disgox.UserErrorf("That role does not exist.")
	}

	requiredPoints, err := modalInt(e.Data, activityRequiredPointsInput, "required points", 0, math.MaxInt32)
	if err != nil {
		return err
	}

	if err := e.DeferUpdateMessage(); err != nil {
		return err
	}

	if err := c.db.Guilds.UpdateActivityRole(e.Ctx, *e.GuildID(), roleID, int32(requiredPoints)); err != nil {
		if errors.Is(err, database.ErrActivityRoleNotFound) {
			return disgox.WrapUserError(err, "That role is no longer an activity role.")
		}

		return err
	}

	return c.refreshRolesCard(e)
}

func (c *chatActivityCommand) openRemoveRoles(_ discord.ButtonInteractionData, e *handler.ComponentEvent) error {
	roles, err := c.db.Guilds.GetActivityRoles(e.Ctx, *e.GuildID(), database.ActivityTypeChat)
	if err != nil {
		return err
	}

	if len(roles) == 0 {
		return disgox.UserErrorf("There are no chat activity roles to remove.")
	}

	options := activityRoleOptions(e.Client(), *e.GuildID(), roles)

	modal := discord.NewModalCreate(chatActivityRemoveRoleID, "Remove Chat Activity Roles").
		AddComponents(
			discord.NewLabel("Roles",
				discord.NewStringSelectMenu(activityRemoveRolesInput, "Pick the roles to remove", options...).
					WithMinValues(1).
					WithMaxValues(len(options)).
					WithRequired(true),
			).WithDescription("Members keep these roles, they just stop being given out."),
		)

	return e.Modal(modal)
}

func (c *chatActivityCommand) removeRoles(e *handler.ModalEvent) error {
	guildID := *e.GuildID()

	if err := e.DeferUpdateMessage(); err != nil {
		return err
	}

	for _, value := range e.Data.StringValues(activityRemoveRolesInput) {
		roleID, err := snowflake.Parse(value)
		if err != nil {
			continue
		}

		// another admin may have removed it already.
		if err := c.db.Guilds.DeleteActivityRole(e.Ctx, guildID, roleID); err != nil && !errors.Is(err, database.ErrActivityRoleNotFound) {
			return err
		}
	}

	return c.refreshRolesCard(e)
}

// activityRoleOptions lists activity roles as select menu options, with their required points.
// Only the first 25 roles fit in a select menu.
func activityRoleOptions(client *bot.Client, guildID snowflake.ID, roles []gen.GetGuildActivityRolesRow) []discord.StringSelectMenuOption {
	roles = roles[:min(len(roles), maxSelectValues)]

	options := make([]discord.StringSelectMenuOption, len(roles))
	for i, role := range roles {
		options[i] = discord.NewStringSelectMenuOption(
			choiceName(roleLabel(client, guildID, role.RoleID)),
			role.RoleID.String(),
		).WithDescription(fmt.Sprintf("%d points", ptr.Value(role.RequiredPoints)))
	}

	return options
}

// roleLabel names a role for a select menu option, falling back to its ID for deleted roles.
func roleLabel(client *bot.Client, guildID, roleID snowflake.ID) string {
	if role, ok := client.Caches.Role(guildID, roleID); ok {
		return "@" + role.Name
	}

	return roleID.String()
}
