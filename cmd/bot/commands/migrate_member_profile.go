package commands

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"strings"

	"github.com/disgoorg/disgo/bot"
	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/handler"
	"github.com/disgoorg/disgo/rest"
	"github.com/disgoorg/omit"
	"github.com/disgoorg/snowflake/v2"
	"github.com/typical-developers/main-discord-bot/cmd/bot/handlers"
	"github.com/typical-developers/main-discord-bot/internal/config"
	"github.com/typical-developers/main-discord-bot/internal/database"
	"github.com/typical-developers/main-discord-bot/internal/database/gen"
	"github.com/typical-developers/main-discord-bot/internal/disgox"
)

// Custom IDs for the migration preview, filled in with the old and new member's IDs where needed.
//
// The flow is: the command replies with a preview card -> "Migrate" opens a confirmation modal ->
// submitting the modal runs the migration and edits the preview card into the result.
const (
	migrateButtonID  = "/migrate-member-profile/migrate/%s/%s"
	migrateCancelID  = "/migrate-member-profile/cancel"
	migrateConfirmID = "/migrate-member-profile/confirm/%s/%s"
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
	// Discord only gates the command itself, so the buttons and modal are checked here too.
	r.Use(c.requireMigrator)

	r.SlashCommand("/", c.migrate)
	r.Modal("/confirm/{from}/{to}", c.confirm)

	r.Group(func(r handler.Router) {
		r.Use(handlers.RequireOriginalInvoker)
		r.ButtonComponent("/migrate/{from}/{to}", c.openConfirm)
		r.ButtonComponent("/cancel", c.cancel)
	})
}

// requireMigrator only lets users who are allowed to migrate profiles through.
func (c *migrateMemberProfileCommand) requireMigrator(next handler.Handler) handler.Handler {
	return func(e *handler.InteractionEvent) error {
		if !c.cfg.CanMigrateProfiles(e.User().ID) {
			return disgox.UserErrorf("You are not allowed to run this command.")
		}

		return next(e)
	}
}

// migrate replies with a preview of the migration. Nothing is changed until it's confirmed.
func (c *migrateMemberProfileCommand) migrate(data discord.SlashCommandInteractionData, e *handler.CommandEvent) error {
	guildID := *e.GuildID()
	from := data.User("from-user")
	to := data.User("to-user")

	preview, err := c.preview(e.Ctx, e.Client(), guildID, from, to)
	if err != nil {
		return err
	}

	return e.CreateMessage(discord.MessageCreate{
		Flags:           discord.MessageFlagEphemeral | discord.MessageFlagIsComponentsV2,
		Components:      []discord.LayoutComponent{c.previewCard(preview)},
		AllowedMentions: &discord.AllowedMentions{},
	})
}

// openConfirm opens the confirmation modal for the "Migrate" button on the preview card.
func (c *migrateMemberProfileCommand) openConfirm(_ discord.ButtonInteractionData, e *handler.ComponentEvent) error {
	fromID, toID, err := migrationMembers(e.Vars)
	if err != nil {
		return err
	}

	modal := discord.NewModalCreate(fmt.Sprintf(migrateConfirmID, fromID, toID), "Confirm Profile Migration")
	modal.Components = append(modal.Components,
		discord.NewTextDisplay(fmt.Sprintf(
			"Are you sure you want to migrate <@%s>'s profile to <@%s>?", fromID, toID,
		)),
		discord.NewTextDisplay("The old profile is reset and its activity roles are removed. **This cannot be undone.**"),
		discord.NewTextDisplay("-# Press **Submit** to migrate, or close this window to cancel."),
	)

	return e.Modal(modal)
}

// cancel replaces the preview card with a cancelled card.
func (c *migrateMemberProfileCommand) cancel(_ discord.ButtonInteractionData, e *handler.ComponentEvent) error {
	card := discord.NewContainer(
		discord.NewTextDisplay("### Migration Cancelled"),
		discord.NewTextDisplay("No changes were made to either profile."),
	)

	return e.UpdateMessage(discord.NewMessageUpdate().
		WithIsComponentsV2(true).
		WithComponents(card),
	)
}

// confirm runs the migration once the confirmation modal is submitted, then edits the preview card
// into the result. Points are read again when migrating, so the result can differ slightly from
// the preview if either member earned points in between.
func (c *migrateMemberProfileCommand) confirm(e *handler.ModalEvent) error {
	guildID := *e.GuildID()

	fromID, toID, err := migrationMembers(e.Vars)
	if err != nil {
		return err
	}

	// the modal was opened from the preview card's button, so this edits the preview card.
	if err := e.DeferUpdateMessage(); err != nil {
		return err
	}

	migration, err := c.db.Members.MigrateProfile(e.Ctx, guildID, fromID, toID)
	if err != nil {
		switch {
		case errors.Is(err, database.ErrMemberProfileNotFound):
			return disgox.WrapUserError(err, fmt.Sprintf("<@%s> does not have a profile to migrate.", fromID))
		case errors.Is(err, database.ErrMemberProfileMigrateSelf):
			return disgox.WrapUserError(err, "A profile cannot be migrated to the same member.")
		}

		return err
	}

	// the profile has been migrated at this point, so role changes are best effort.
	// roles are earned with the new member's points across every linked server.
	var granted []snowflake.ID
	grantedAll := false
	if linked, err := c.db.Members.GetLinkedPoints(e.Ctx, guildID, toID); err != nil {
		slog.Error("failed to get migrated member's linked points", slog.String("member_id", toID.String()), slog.Any("err", err))
	} else {
		granted, grantedAll = c.grantActivityRoles(e.Ctx, e.Client().Rest, guildID, toID, linked.Chat)
	}
	removed, removedAll := c.removeActivityRoles(e.Ctx, e.Client().Rest, guildID, fromID)

	card := c.resultCard(fromID, toID, migration, granted, removed, grantedAll, removedAll)

	_, err = e.UpdateInteractionResponse(discord.NewMessageUpdate().
		WithIsComponentsV2(true).
		WithComponents(card),
	)
	return err
}

// migrationMembers returns the old and new member's IDs from a migration button or modal's custom ID.
func migrationMembers(vars map[string]string) (snowflake.ID, snowflake.ID, error) {
	fromID, err := snowflake.Parse(vars["from"])
	if err != nil {
		return 0, 0, fmt.Errorf("invalid migration member ID %q: %w", vars["from"], err)
	}

	toID, err := snowflake.Parse(vars["to"])
	if err != nil {
		return 0, 0, fmt.Errorf("invalid migration member ID %q: %w", vars["to"], err)
	}

	return fromID, toID, nil
}

// migrationPreview is what a migration would change, worked out before it runs.
type migrationPreview struct {
	from, to     discord.User
	fromProfile  gen.GetMemberProfileRow
	toProfile    gen.GetMemberProfileRow
	toHasProfile bool
	// toLinkedPoints are the new member's points across every linked server, before the migration.
	toLinkedPoints database.ActivityPoints
	fromInServer   bool
	// grantRoles are the chat activity roles the new member earns with the combined points and doesn't have yet.
	grantRoles []snowflake.ID
	// removeRoles are the chat activity roles the old member has.
	removeRoles []snowflake.ID
}

// Only the points earned in this server are migrated. The Guild* fields are this server's points;
// the others are added up across every linked server.

// chatTotal is the new member's chat points in this server after the migration.
func (p migrationPreview) chatTotal() int32 {
	return p.toProfile.GuildChatActivity + p.fromProfile.GuildChatActivity
}

// voiceTotal is the new member's voice points in this server after the migration.
func (p migrationPreview) voiceTotal() int32 {
	return p.toProfile.GuildVoiceActivity + p.fromProfile.GuildVoiceActivity
}

// linkedChatTotal is the new member's chat points across every linked server after the migration,
// which activity roles are earned with.
func (p migrationPreview) linkedChatTotal() int32 {
	return p.toLinkedPoints.Chat + p.fromProfile.GuildChatActivity
}

// preview works out what migrating from's profile to to would change, without changing anything.
func (c *migrateMemberProfileCommand) preview(ctx context.Context, client *bot.Client, guildID snowflake.ID, from, to discord.User) (migrationPreview, error) {
	p := migrationPreview{from: from, to: to}

	if from.ID == to.ID {
		return p, disgox.UserErrorf("A profile cannot be migrated to the same member.")
	}

	// it doesn't make sense to migrate to someone who isn't in the server.
	toMember, err := client.Rest.GetMember(guildID, to.ID)
	if err != nil {
		return p, disgox.WrapUserError(err, "The user being migrated to is not in this server.")
	}

	p.fromProfile, err = c.db.Members.GetProfile(ctx, guildID, from.ID)
	if err != nil {
		if errors.Is(err, database.ErrMemberProfileNotFound) {
			return p, disgox.WrapUserError(err, fmt.Sprintf("<@%s> does not have a profile to migrate.", from.ID))
		}

		return p, err
	}

	// the new member doesn't need a profile, one is created for them.
	p.toProfile, err = c.db.Members.GetProfile(ctx, guildID, to.ID)
	p.toHasProfile = err == nil
	if err != nil && !errors.Is(err, database.ErrMemberProfileNotFound) {
		return p, err
	}

	// the new member may have points in linked servers even without a profile in this one.
	p.toLinkedPoints, err = c.db.Members.GetLinkedPoints(ctx, guildID, to.ID)
	if err != nil {
		return p, err
	}

	earned, err := c.db.Members.GetActivityRoleInfo(ctx, guildID, database.ActivityTypeChat, p.linkedChatTotal())
	if err != nil {
		return p, err
	}
	p.grantRoles = missingRoles(earned.CurrentRolesIds, toMember.RoleIDs)

	// the old member may have left the server, then there are no roles to remove.
	if fromMember, err := client.Rest.GetMember(guildID, from.ID); err == nil {
		p.fromInServer = true

		activityRoles, err := c.db.Guilds.GetActivityRoles(ctx, guildID, database.ActivityTypeChat)
		if err != nil {
			return p, err
		}
		p.removeRoles = heldActivityRoles(activityRoles, fromMember.RoleIDs)
	}

	return p, nil
}

// previewCard builds the container card that shows what a migration will change, with the buttons
// to run or cancel it. It must be sent with discord.MessageFlagIsComponentsV2.
func (c *migrateMemberProfileCommand) previewCard(p migrationPreview) discord.ContainerComponent {
	newProfileNote := ""
	if !p.toHasProfile {
		newProfileNote = "\nA new profile will be created for them."
	}

	removeNone := "None"
	if !p.fromInServer {
		removeNone = "None, they are not in this server."
	}

	return discord.NewContainer(
		discord.NewTextDisplay("### 🔁 Profile Migration"),
		discord.NewTextDisplay(fmt.Sprintf(
			"**From:** <@%s> (`%s`)\n**To:** <@%s> (`%s`)%s",
			p.from.ID, p.from.Username, p.to.ID, p.to.Username, newProfileNote,
		)),
		discord.NewLargeSeparator(),
		discord.NewTextDisplay(fmt.Sprintf(
			"### Points\n"+
				"**Chat Activity:** `%d` transferred (`%d` → `%d`)\n"+
				"**Voice Activity:** `%d` transferred (`%d` → `%d`)",
			p.fromProfile.GuildChatActivity, p.toProfile.GuildChatActivity, p.chatTotal(),
			p.fromProfile.GuildVoiceActivity, p.toProfile.GuildVoiceActivity, p.voiceTotal(),
		)),
		discord.NewTextDisplay(fmt.Sprintf(
			"### Roles\n**%s will receive:** %s\n**%s will lose:** %s",
			p.to.Username, roleList(p.grantRoles, "None"),
			p.from.Username, roleList(p.removeRoles, removeNone),
		)),
		discord.NewLargeSeparator(),
		discord.NewTextDisplay("-# Activity grant history does not apply. Other profile information will be merged as well."),
		discord.NewActionRow(
			discord.NewDangerButton("Migrate", fmt.Sprintf(migrateButtonID, p.from.ID, p.to.ID)),
			discord.NewSecondaryButton("Cancel", migrateCancelID),
		),
	)
}

// resultCard builds the container card that's shown once a profile has been migrated.
// It must be sent with discord.MessageFlagIsComponentsV2.
func (c *migrateMemberProfileCommand) resultCard(
	fromID, toID snowflake.ID,
	migration database.ProfileMigration,
	granted, removed []snowflake.ID,
	grantedAll, removedAll bool,
) discord.ContainerComponent {
	components := []discord.ContainerSubComponent{
		discord.NewTextDisplay("### ✅ Profile Migrated"),
		discord.NewTextDisplay(fmt.Sprintf(
			"**From:** <@%s> (`%s`)\n**To:** <@%s> (`%s`)",
			fromID, fromID, toID, toID,
		)),
		discord.NewLargeSeparator(),
		discord.NewTextDisplay(fmt.Sprintf(
			"### Points\n**Chat Activity:** `%d` transferred, now `%d`\n**Voice Activity:** `%d` transferred, now `%d`",
			migration.From.ChatActivity, migration.To.ChatActivity,
			migration.From.VoiceActivity, migration.To.VoiceActivity,
		)),
		discord.NewTextDisplay(fmt.Sprintf(
			"### Roles\n**Granted:** %s\n**Removed:** %s",
			roleList(granted, "None"),
			roleList(removed, "None"),
		)),
	}

	var warnings []string
	if !grantedAll {
		warnings = append(warnings, "⚠️ Some roles could not be given to the new user, please add them manually.")
	}
	if !removedAll {
		warnings = append(warnings, "⚠️ Some old roles could not be removed from the old user, please remove them manually.")
	}

	if len(warnings) > 0 {
		components = append(components,
			discord.NewLargeSeparator(),
			discord.NewTextDisplay(strings.Join(warnings, "\n")),
		)
	}

	components = append(components,
		discord.NewTextDisplay("-# Activity grant history does not apply. Other profile information will be merged as well."),
	)

	return discord.NewContainer(components...)
}

// grantActivityRoles gives a member every chat activity role they have earned with the given points
// and don't have yet. It returns the roles that were added, and false if any role could not be added.
func (c *migrateMemberProfileCommand) grantActivityRoles(ctx context.Context, client rest.Rest, guildID, memberID snowflake.ID, points int32) ([]snowflake.ID, bool) {
	member, err := client.GetMember(guildID, memberID)
	if err != nil {
		slog.Error("failed to get migrated member", slog.String("member_id", memberID.String()), slog.Any("err", err))
		return nil, false
	}

	earned, err := c.db.Members.GetActivityRoleInfo(ctx, guildID, database.ActivityTypeChat, points)
	if err != nil {
		slog.Error("failed to get activity role info", slog.Any("err", err))
		return nil, false
	}

	var granted []snowflake.ID
	ok := true
	for _, roleID := range missingRoles(earned.CurrentRolesIds, member.RoleIDs) {
		if err := client.AddMemberRole(guildID, memberID, roleID,
			rest.WithReason("Automated Action - Member profile was migrated from another user."),
		); err != nil {
			slog.Error("failed to add activity role", slog.String("role_id", roleID.String()), slog.Any("err", err))
			ok = false
			continue
		}

		granted = append(granted, roleID)
	}

	return granted, ok
}

// removeActivityRoles removes chat activity roles from a member whose profile was migrated.
// It returns the roles that were removed, and false if any role could not be removed.
func (c *migrateMemberProfileCommand) removeActivityRoles(ctx context.Context, client rest.Rest, guildID, memberID snowflake.ID) ([]snowflake.ID, bool) {
	member, err := client.GetMember(guildID, memberID)
	if err != nil {
		// they left the server, so there's nothing to remove.
		return nil, true
	}

	activityRoles, err := c.db.Guilds.GetActivityRoles(ctx, guildID, database.ActivityTypeChat)
	if err != nil {
		slog.Error("failed to get activity roles", slog.Any("err", err))
		return nil, false
	}

	var removed []snowflake.ID
	ok := true
	for _, roleID := range heldActivityRoles(activityRoles, member.RoleIDs) {
		if err := client.RemoveMemberRole(guildID, memberID, roleID,
			rest.WithReason("Automated Action - Member profile was migrated to another user."),
		); err != nil {
			slog.Error("failed to remove activity role", slog.String("role_id", roleID.String()), slog.Any("err", err))
			ok = false
			continue
		}

		removed = append(removed, roleID)
	}

	return removed, ok
}

// roleList formats roles as a comma separated list of role mentions, or none when there are no roles.
// The messages these are shown in don't allow mentions, so nobody is pinged.
func roleList(roleIDs []snowflake.ID, none string) string {
	if len(roleIDs) == 0 {
		return none
	}

	mentions := make([]string, 0, len(roleIDs))
	for _, roleID := range roleIDs {
		mentions = append(mentions, "<@&"+roleID.String()+">")
	}

	return strings.Join(mentions, ", ")
}

// missingRoles returns the roles in earned that are not in has.
func missingRoles(earned, has []snowflake.ID) []snowflake.ID {
	var missing []snowflake.ID
	for _, roleID := range earned {
		if !slices.Contains(has, roleID) {
			missing = append(missing, roleID)
		}
	}

	return missing
}

// heldActivityRoles returns the activity roles that are in has.
func heldActivityRoles(activityRoles []gen.GetGuildActivityRolesRow, has []snowflake.ID) []snowflake.ID {
	var held []snowflake.ID
	for _, role := range activityRoles {
		if slices.Contains(has, role.RoleID) {
			held = append(held, role.RoleID)
		}
	}

	return held
}
