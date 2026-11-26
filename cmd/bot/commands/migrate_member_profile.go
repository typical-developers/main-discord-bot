package commands

import (
	"errors"
	"fmt"
	"log/slog"
	"slices"

	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/handler"
	"github.com/disgoorg/disgo/rest"
	"github.com/disgoorg/omit"
	"github.com/disgoorg/snowflake/v2"
	"github.com/typical-developers/main-discord-bot/cmd/bot/handlers"
	"github.com/typical-developers/main-discord-bot/internal/config"
	"github.com/typical-developers/main-discord-bot/internal/database"
	"github.com/typical-developers/main-discord-bot/internal/disgox"
)

type migrateMemberProfileCommand struct {
	cfg *config.Config
	db  *database.Database
}

func newMigrateMemberProfileCommand(cfg *config.Config, db *database.Database) *migrateMemberProfileCommand {
	return &migrateMemberProfileCommand{cfg, db}
}

func (c *migrateMemberProfileCommand) Create() discord.ApplicationCommandCreate {
	return discord.SlashCommandCreate{
		Name:                     "migrate-member-profile",
		Description:              "Migrate the profile of a server member to another member.",
		DefaultMemberPermissions: omit.NewPtr(discord.PermissionAdministrator),
		Contexts:                 guildOnly,
		Options: []discord.ApplicationCommandOption{
			discord.ApplicationCommandOptionUser{
				Name:        "from-user",
				Description: "The member you'd like to migrate from.",
				Required:    true,
			},
			discord.ApplicationCommandOptionUser{
				Name:        "to-user",
				Description: "The member you'd like to migrate to.",
				Required:    true,
			},
		},
	}
}

func (c *migrateMemberProfileCommand) Register(r handler.Router) {
	r.Use(handlers.GuildOnly)
	r.SlashCommand("/", c.migrate)
}

func (c *migrateMemberProfileCommand) migrate(data discord.SlashCommandInteractionData, e *handler.CommandEvent) error {
	if !c.cfg.CanMigrateProfiles(e.User().ID) {
		return disgox.UserErrorf("You are not allowed to run this command.")
	}

	guildID := *e.GuildID()
	from := data.User("from-user")
	to := data.User("to-user")

	// it doesn't make sense to migrate to someone who isn't in the server.
	if _, err := e.Client().Rest.GetMember(guildID, to.ID); err != nil {
		return disgox.WrapUserError(err, "The user being migrated to is not in this server.")
	}

	if err := e.DeferCreateMessage(true); err != nil {
		return err
	}

	if err := c.db.Members.MigrateProfile(e.Ctx, guildID, from.ID, to.ID); err != nil {
		switch {
		case errors.Is(err, database.ErrMemberProfileNotFound):
			return disgox.WrapUserError(err, fmt.Sprintf("<@%s> does not have a profile to migrate.", from.ID))
		case errors.Is(err, database.ErrMemberProfileMigrateSelf):
			return disgox.WrapUserError(err, "A profile cannot be migrated to the same member.")
		}

		return err
	}

	// removing the old member's activity roles is best effort.
	removedRoles := c.removeActivityRoles(e, from.ID)

	content := fmt.Sprintf("Successfully migrated the member profile: <@%s> (%s) -> <@%s> (%s).", from.ID, from.ID, to.ID, to.ID)
	if !removedRoles {
		content += " Old roles could not be removed from the user, please remove them manually."
	}

	_, err := e.CreateFollowupMessage(discord.MessageCreate{Content: content})
	return err
}

// removeActivityRoles removes chat activity roles from a member whose profile was migrated.
// It reports false if any role could not be removed.
func (c *migrateMemberProfileCommand) removeActivityRoles(e *handler.CommandEvent, memberID snowflake.ID) bool {
	guildID := *e.GuildID()

	member, err := e.Client().Rest.GetMember(guildID, memberID)
	if err != nil {
		// they left the server, so there's nothing to remove.
		return true
	}

	activityRoles, err := c.db.Guilds.GetActivityRoles(e.Ctx, guildID, database.ActivityTypeChat)
	if err != nil {
		slog.Error("failed to get activity roles", slog.Any("err", err))
		return false
	}

	removed := true
	for _, role := range activityRoles {
		if !slices.Contains(member.RoleIDs, role.RoleID) {
			continue
		}

		if err := e.Client().Rest.RemoveMemberRole(guildID, memberID, role.RoleID,
			rest.WithReason("Automated Action - Member profile was migrated to another user."),
		); err != nil {
			removed = false
		}
	}

	return removed
}
