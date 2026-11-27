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

// Custom IDs for the migration, filled in with the old and new member's IDs and the scope where needed.
//
// The flow is: the command opens the migration modal -> submitting it replies with a preview card ->
// "Migrate" opens a confirmation modal -> submitting that runs the migration and edits the preview
// card into the result.
const (
	migrateStartID   = "/migrate-member-profile/start"
	migrateButtonID  = "/migrate-member-profile/migrate/%s/%s/%s"
	migrateCancelID  = "/migrate-member-profile/cancel"
	migrateConfirmID = "/migrate-member-profile/confirm/%s/%s/%s"

	migrateFromUserIDInput = "from_user_id"
	migrateToUserInput     = "to_user"
	migrateLinkedInput     = "linked"

	// migrateScopeServer only migrates the profile in this server.
	migrateScopeServer = "server"
	// migrateScopeLinked also migrates the profiles in every server linked to this one.
	migrateScopeLinked = "linked"
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
	}
}

func (c *migrateMemberProfileCommand) Register(r handler.Router) {
	r.Use(handlers.GuildOnly)
	// Discord only gates the command itself, so the buttons and modals are checked here too.
	r.Use(c.requireMigrator)

	r.SlashCommand("/", c.openMigrate)
	r.Modal("/start", c.start)
	r.Modal("/confirm/{from}/{to}/{scope}", c.confirm)

	r.Group(func(r handler.Router) {
		r.Use(handlers.RequireOriginalInvoker)
		r.ButtonComponent("/migrate/{from}/{to}/{scope}", c.openConfirm)
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

// openMigrate opens the migration modal. Nothing is changed until the migration is confirmed.
func (c *migrateMemberProfileCommand) openMigrate(_ discord.SlashCommandInteractionData, e *handler.CommandEvent) error {
	linked, err := c.db.Guilds.GetLinkedGuilds(e.Ctx, *e.GuildID())
	if err != nil {
		return err
	}

	modal := discord.NewModalCreate(migrateStartID, "Migrate Member Profile").
		AddComponents(
			discord.NewLabel("From User ID",
				discord.NewShortTextInput(migrateFromUserIDInput).
					WithPlaceholder("e.g. 865737627712749579").
					WithMinLength(17).
					WithMaxLength(20).
					WithRequired(true),
			).WithDescription("The ID of the user to migrate from. They don't need to be in the server."),
			discord.NewLabel("To Member",
				discord.NewUserSelectMenu(migrateToUserInput, "Pick a member").
					WithMaxValues(1).
					WithRequired(true),
			).WithDescription("The member to migrate to. They must be in this server."),
		)

	// only shown when there are linked servers to migrate in.
	if len(linked) > 0 {
		modal = modal.AddComponents(
			discord.NewLabel("Linked Servers", discord.CheckboxComponent{CustomID: migrateLinkedInput}).
				WithDescription(fmt.Sprintf("Also migrate their profiles in the %d linked server(s).", len(linked))),
		)
	}

	return e.Modal(modal)
}

// start replies with a preview of the migration picked in the migration modal.
func (c *migrateMemberProfileCommand) start(e *handler.ModalEvent) error {
	from, err := c.migrationFromUser(e)
	if err != nil {
		return err
	}

	toUsers := e.Data.Users(migrateToUserInput)
	if len(toUsers) != 1 {
		return disgox.UserErrorf("Pick the member to migrate to.")
	}
	to := toUsers[0]

	scope := migrateScopeServer
	if modalCheckbox(e.Data, migrateLinkedInput) {
		scope = migrateScopeLinked
	}

	// working out the preview looks up members in every server, which can take a while.
	if err := e.DeferCreateMessage(true); err != nil {
		return err
	}

	preview, err := c.preview(e.Ctx, e.Client(), *e.GuildID(), from, to, scope)
	if err != nil {
		return err
	}

	_, err = e.UpdateInteractionResponse(discord.NewMessageUpdate().
		WithIsComponentsV2(true).
		WithComponents(c.previewCard(preview)).
		WithAllowedMentions(&discord.AllowedMentions{}),
	)
	return err
}

// migrationFromUser returns the user to migrate from, looked up by the ID entered in the migration modal.
// They don't need to be in the server, since the old account may have left.
func (c *migrateMemberProfileCommand) migrationFromUser(e *handler.ModalEvent) (discord.User, error) {
	userID, err := snowflake.Parse(strings.TrimSpace(e.Data.Text(migrateFromUserIDInput)))
	if err != nil {
		return discord.User{}, disgox.WrapUserError(err, "That is not a valid user ID.")
	}

	user, err := e.Client().Rest.GetUser(userID, rest.WithCtx(e.Ctx))
	if err != nil {
		return discord.User{}, disgox.WrapUserError(err, "There is no user with that ID.")
	}

	return *user, nil
}

// openConfirm opens the confirmation modal for the "Migrate" button on the preview card.
func (c *migrateMemberProfileCommand) openConfirm(_ discord.ButtonInteractionData, e *handler.ComponentEvent) error {
	fromID, toID, scope, err := migrationVars(e.Vars)
	if err != nil {
		return err
	}

	where := "in this server"
	if scope == migrateScopeLinked {
		where = "in this server and every linked server"
	}

	modal := discord.NewModalCreate(fmt.Sprintf(migrateConfirmID, fromID, toID, scope), "Confirm Profile Migration")
	modal.Components = append(modal.Components,
		discord.NewTextDisplay(fmt.Sprintf(
			"Are you sure you want to migrate <@%s>'s profile to <@%s> %s?", fromID, toID, where,
		)),
		discord.NewTextDisplay("The old profiles are reset and their activity roles are removed. **This cannot be undone.**"),
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

	fromID, toID, scope, err := migrationVars(e.Vars)
	if err != nil {
		return err
	}

	// the modal was opened from the preview card's button, so this edits the preview card.
	if err := e.DeferUpdateMessage(); err != nil {
		return err
	}

	guildIDs, err := c.migrationGuilds(e.Ctx, guildID, scope)
	if err != nil {
		return err
	}

	migrations, err := c.db.Members.MigrateProfiles(e.Ctx, guildIDs, fromID, toID)
	if err != nil {
		switch {
		case errors.Is(err, database.ErrMemberProfileNotFound):
			return disgox.WrapUserError(err, fmt.Sprintf("<@%s> does not have a profile to migrate.", fromID))
		case errors.Is(err, database.ErrMemberProfileMigrateSelf):
			return disgox.WrapUserError(err, "A profile cannot be migrated to the same member.")
		}

		return err
	}

	// the profiles have been migrated at this point, so role changes are best effort.
	// roles are earned with the new member's points across every linked server, which is the same
	// total for every server in the group.
	linked, linkedErr := c.db.Members.GetLinkedPoints(e.Ctx, guildID, toID)
	if linkedErr != nil {
		slog.Error("failed to get migrated member's linked points", slog.String("member_id", toID.String()), slog.Any("err", linkedErr))
	}

	results := make([]guildMigrationResult, len(migrations))
	for i, migration := range migrations {
		result := guildMigrationResult{
			name:      guildName(e.Client(), migration.GuildID),
			migration: migration.ProfileMigration,
		}

		if linkedErr == nil {
			result.granted, result.grantedAll = c.grantActivityRoles(e.Ctx, e.Client().Rest, migration.GuildID, toID, linked.Chat)
		}
		result.removed, result.removedAll = c.removeActivityRoles(e.Ctx, e.Client().Rest, migration.GuildID, fromID)

		results[i] = result
	}

	_, err = e.UpdateInteractionResponse(discord.NewMessageUpdate().
		WithIsComponentsV2(true).
		WithComponents(c.resultCard(fromID, toID, results)).
		WithAllowedMentions(&discord.AllowedMentions{}),
	)
	return err
}

// migrationVars returns the old and new member's IDs and the scope from a migration button or modal's custom ID.
func migrationVars(vars map[string]string) (snowflake.ID, snowflake.ID, string, error) {
	fromID, err := snowflake.Parse(vars["from"])
	if err != nil {
		return 0, 0, "", fmt.Errorf("invalid migration member ID %q: %w", vars["from"], err)
	}

	toID, err := snowflake.Parse(vars["to"])
	if err != nil {
		return 0, 0, "", fmt.Errorf("invalid migration member ID %q: %w", vars["to"], err)
	}

	scope := vars["scope"]
	if scope != migrateScopeServer && scope != migrateScopeLinked {
		return 0, 0, "", fmt.Errorf("invalid migration scope %q", scope)
	}

	return fromID, toID, scope, nil
}

// migrationGuilds returns the servers a migration runs in: this server first, then the linked
// servers when the scope includes them.
func (c *migrateMemberProfileCommand) migrationGuilds(ctx context.Context, guildID snowflake.ID, scope string) ([]snowflake.ID, error) {
	guildIDs := []snowflake.ID{guildID}
	if scope != migrateScopeLinked {
		return guildIDs, nil
	}

	linked, err := c.db.Guilds.GetLinkedGuilds(ctx, guildID)
	if err != nil {
		return nil, err
	}

	for _, link := range linked {
		guildIDs = append(guildIDs, link.GuildID)
	}

	return guildIDs, nil
}

// guildMigrationPreview is what a migration would change in one server.
type guildMigrationPreview struct {
	guildID      snowflake.ID
	name         string
	fromProfile  gen.GetMemberProfileRow
	toProfile    gen.GetMemberProfileRow
	toHasProfile bool
	toInServer   bool
	fromInServer bool
	// grantRoles are the chat activity roles the new member earns with the combined points and doesn't have yet.
	grantRoles []snowflake.ID
	// removeRoles are the chat activity roles the old member has.
	removeRoles []snowflake.ID
}

// chatTotal is the new member's chat points in this server after the migration.
func (g guildMigrationPreview) chatTotal() int32 {
	return g.toProfile.GuildChatActivity + g.fromProfile.GuildChatActivity
}

// voiceTotal is the new member's voice points in this server after the migration.
func (g guildMigrationPreview) voiceTotal() int32 {
	return g.toProfile.GuildVoiceActivity + g.fromProfile.GuildVoiceActivity
}

// migrationPreview is what a migration would change, worked out before it runs.
type migrationPreview struct {
	from, to discord.User
	scope    string
	// toLinkedPoints are the new member's points across every linked server, before the migration.
	toLinkedPoints database.ActivityPoints
	// guilds are the servers the old member has a profile in that will be migrated, this server first.
	guilds []guildMigrationPreview
}

// linkedChatTotal is the new member's chat points across every linked server after the migration,
// which activity roles are earned with.
func (p migrationPreview) linkedChatTotal() int32 {
	total := p.toLinkedPoints.Chat
	for _, g := range p.guilds {
		total += g.fromProfile.GuildChatActivity
	}

	return total
}

// preview works out what migrating from's profile to to would change, without changing anything.
func (c *migrateMemberProfileCommand) preview(ctx context.Context, client *bot.Client, guildID snowflake.ID, from, to discord.User, scope string) (migrationPreview, error) {
	p := migrationPreview{from: from, to: to, scope: scope}

	if from.ID == to.ID {
		return p, disgox.UserErrorf("A profile cannot be migrated to the same member.")
	}

	// it doesn't make sense to migrate to someone who isn't in the server.
	if _, err := client.Rest.GetMember(guildID, to.ID, rest.WithCtx(ctx)); err != nil {
		return p, disgox.WrapUserError(err, "The user being migrated to is not in this server.")
	}

	guildIDs, err := c.migrationGuilds(ctx, guildID, scope)
	if err != nil {
		return p, err
	}

	// the new member may have points in linked servers even without a profile in this one.
	p.toLinkedPoints, err = c.db.Members.GetLinkedPoints(ctx, guildID, to.ID)
	if err != nil {
		return p, err
	}

	toRoles := make(map[snowflake.ID][]snowflake.ID)
	fromRoles := make(map[snowflake.ID][]snowflake.ID)

	for _, id := range guildIDs {
		g := guildMigrationPreview{guildID: id, name: guildName(client, id)}

		g.fromProfile, err = c.db.Members.GetProfile(ctx, id, from.ID)
		if errors.Is(err, database.ErrMemberProfileNotFound) {
			// there's nothing to migrate in this server.
			continue
		}
		if err != nil {
			return p, err
		}

		// the new member doesn't need a profile, one is created for them.
		g.toProfile, err = c.db.Members.GetProfile(ctx, id, to.ID)
		g.toHasProfile = err == nil
		if err != nil && !errors.Is(err, database.ErrMemberProfileNotFound) {
			return p, err
		}

		// either member may not be in a linked server, then there are no roles to change there.
		if member, err := client.Rest.GetMember(id, to.ID, rest.WithCtx(ctx)); err == nil {
			g.toInServer = true
			toRoles[id] = member.RoleIDs
		}
		if member, err := client.Rest.GetMember(id, from.ID, rest.WithCtx(ctx)); err == nil {
			g.fromInServer = true
			fromRoles[id] = member.RoleIDs
		}

		p.guilds = append(p.guilds, g)
	}

	if len(p.guilds) == 0 {
		if scope == migrateScopeLinked {
			return p, disgox.UserErrorf("<@%s> does not have a profile to migrate in this server or any linked server.", from.ID)
		}

		return p, disgox.UserErrorf("<@%s> does not have a profile to migrate.", from.ID)
	}

	// roles depend on the combined points, so they're worked out once every server is known.
	for i := range p.guilds {
		g := &p.guilds[i]

		if g.toInServer {
			earned, err := c.db.Members.GetActivityRoleInfo(ctx, g.guildID, database.ActivityTypeChat, p.linkedChatTotal())
			if err != nil {
				return p, err
			}
			g.grantRoles = missingRoles(earned.CurrentRolesIds, toRoles[g.guildID])
		}

		if g.fromInServer {
			activityRoles, err := c.db.Guilds.GetActivityRoles(ctx, g.guildID, database.ActivityTypeChat)
			if err != nil {
				return p, err
			}
			g.removeRoles = heldActivityRoles(activityRoles, fromRoles[g.guildID])
		}
	}

	return p, nil
}

// previewCard builds the container card that shows what a migration will change, with the buttons
// to run or cancel it. It must be sent with discord.MessageFlagIsComponentsV2.
func (c *migrateMemberProfileCommand) previewCard(p migrationPreview) discord.ContainerComponent {
	components := []discord.ContainerSubComponent{
		discord.NewTextDisplay("### 🔁 Profile Migration"),
		discord.NewTextDisplay(fmt.Sprintf(
			"**From:** <@%s> (`%s`)\n**To:** <@%s> (`%s`)",
			p.from.ID, p.from.Username, p.to.ID, p.to.Username,
		)),
		discord.NewLargeSeparator(),
	}

	for _, g := range p.guilds {
		newProfileNote := ""
		if !g.toHasProfile {
			newProfileNote = fmt.Sprintf("\n-# A new profile will be created for %s here.", p.to.Username)
		}

		receiveNone := "None"
		if !g.toInServer {
			receiveNone = "None, they are not in this server."
		}

		removeNone := "None"
		if !g.fromInServer {
			removeNone = "None, they are not in this server."
		}

		components = append(components, discord.NewTextDisplay(fmt.Sprintf(
			"### %s\n"+
				"**Chat Activity:** `%d` transferred (`%d` → `%d`)\n"+
				"**Voice Activity:** `%d` transferred (`%d` → `%d`)\n"+
				"**%s will receive:** %s\n"+
				"**%s will lose:** %s%s",
			g.name,
			g.fromProfile.GuildChatActivity, g.toProfile.GuildChatActivity, g.chatTotal(),
			g.fromProfile.GuildVoiceActivity, g.toProfile.GuildVoiceActivity, g.voiceTotal(),
			p.to.Username, roleList(g.grantRoles, receiveNone),
			p.from.Username, roleList(g.removeRoles, removeNone),
			newProfileNote,
		)))
	}

	components = append(components,
		discord.NewActionRow(
			discord.NewDangerButton("Migrate", fmt.Sprintf(migrateButtonID, p.from.ID, p.to.ID, p.scope)),
			discord.NewSecondaryButton("Cancel", migrateCancelID),
		),
	)

	return discord.NewContainer(components...)
}

// guildMigrationResult is what a migration changed in one server.
type guildMigrationResult struct {
	name       string
	migration  database.ProfileMigration
	granted    []snowflake.ID
	removed    []snowflake.ID
	grantedAll bool
	removedAll bool
}

// resultCard builds the container card that's shown once a profile has been migrated.
// It must be sent with discord.MessageFlagIsComponentsV2.
func (c *migrateMemberProfileCommand) resultCard(fromID, toID snowflake.ID, results []guildMigrationResult) discord.ContainerComponent {
	components := []discord.ContainerSubComponent{
		discord.NewTextDisplay("### ✅ Profile Migrated"),
		discord.NewTextDisplay(fmt.Sprintf(
			"**From:** <@%s> (`%s`)\n**To:** <@%s> (`%s`)",
			fromID, fromID, toID, toID,
		)),
		discord.NewLargeSeparator(),
	}

	grantedAll, removedAll := true, true
	for _, r := range results {
		grantedAll = grantedAll && r.grantedAll
		removedAll = removedAll && r.removedAll

		components = append(components, discord.NewTextDisplay(fmt.Sprintf(
			"### %s\n"+
				"**Chat Activity:** `%d` transferred, now `%d`\n"+
				"**Voice Activity:** `%d` transferred, now `%d`\n"+
				"**Roles Granted:** %s\n"+
				"**Roles Removed:** %s",
			r.name,
			r.migration.From.ChatActivity, r.migration.To.ChatActivity,
			r.migration.From.VoiceActivity, r.migration.To.VoiceActivity,
			roleList(r.granted, "None"),
			roleList(r.removed, "None"),
		)))
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

	return discord.NewContainer(components...)
}

// grantActivityRoles gives a member every chat activity role they have earned with the given points
// and don't have yet. It returns the roles that were added, and false if any role could not be added.
// Members who aren't in the server are skipped.
func (c *migrateMemberProfileCommand) grantActivityRoles(ctx context.Context, client rest.Rest, guildID, memberID snowflake.ID, points int32) ([]snowflake.ID, bool) {
	member, err := client.GetMember(guildID, memberID, rest.WithCtx(ctx))
	if err != nil {
		if rest.IsJSONErrorCode(err, rest.JSONErrorCodeUnknownMember) {
			return nil, true
		}

		slog.Error("failed to get migrated member", slog.String("guild_id", guildID.String()), slog.String("member_id", memberID.String()), slog.Any("err", err))
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
	member, err := client.GetMember(guildID, memberID, rest.WithCtx(ctx))
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

// guildName names a server for a card heading, falling back to its ID when it isn't cached.
func guildName(client *bot.Client, guildID snowflake.ID) string {
	if guild, ok := client.Caches.Guild(guildID); ok {
		return guild.Name
	}

	return guildID.String()
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
