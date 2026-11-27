package listeners

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"slices"

	"github.com/disgoorg/disgo/bot"
	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/events"
	"github.com/disgoorg/disgo/rest"
	"github.com/disgoorg/snowflake/v2"
	"github.com/typical-developers/main-discord-bot/internal/database"
	"github.com/typical-developers/main-discord-bot/internal/disgox"
	"github.com/typical-developers/main-discord-bot/internal/ptr"
)

// pointsGrant grants chat activity points for messages, hands out the activity roles
// members have earned, and congratulates them when they unlock a new one.
//
// Points earned in linked servers count towards this server's activity roles, but roles are only
// handed out in the server the points were granted in.
type pointsGrant struct {
	db *database.Database
}

func newPointsGrant(db *database.Database) *events.ListenerAdapter {
	p := &pointsGrant{db}

	return &events.ListenerAdapter{
		OnGuildMessageCreate: p.guildMessageCreate,
	}
}

func (p *pointsGrant) guildMessageCreate(e *events.GuildMessageCreate) {
	message := e.Message
	if message.Author.Bot || message.Member == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), listenerTimeout)
	defer cancel()

	log := slog.With(
		slog.String("guild_id", e.GuildID.String()),
		slog.String("member_id", message.Author.ID.String()),
	)

	// checked first so guilds without chat activity don't open a transaction per message.
	settings, err := p.db.Guilds.GetActivitySettings(ctx, e.GuildID, database.ActivityTypeChat)
	if err != nil {
		log.Error("failed to get chat activity settings", slog.Any("err", err))
		return
	}

	if !settings.IsEnabled {
		return
	}

	// members with any of the denied roles don't earn chat activity points.
	if slices.ContainsFunc(message.Member.RoleIDs, func(roleID snowflake.ID) bool {
		return slices.Contains(settings.DenyRoles, roleID)
	}) {
		return
	}

	grant, err := p.grant(ctx, e.GuildID, message.Author.ID)
	if err != nil {
		if errors.Is(err, database.ErrMemberOnGrantCooldown) || errors.Is(err, database.ErrActivityTrackingDisabled) {
			return
		}

		log.Error("failed to grant chat activity points", slog.Any("err", err))
		return
	}

	// activity roles are earned with the member's points across every linked server,
	// but only this server's roles are given out.
	roles, err := p.db.Members.GetActivityRoleInfo(ctx, e.GuildID, database.ActivityTypeChat, grant.LinkedPoints)
	if err != nil {
		log.Error("failed to get activity role info", slog.Any("err", err))
		return
	}

	p.addRoles(e.Client(), e.GuildID, message.Author.ID, message.Member.RoleIDs, roles.CurrentRolesIds, log)

	// the member unlocked a new role if they didn't have enough points for it before this grant.
	previousPoints := grant.LinkedPoints - grant.Granted
	if roles.CurrentRoleID == nil || ptr.Value(roles.CurrentRoleRequiredPoints) <= previousPoints {
		return
	}

	content := fmt.Sprintf("<@%s> Congratulations! You have reached %d points and unlocked the `%s` activity role!",
		message.Author.ID,
		ptr.Value(roles.CurrentRoleRequiredPoints),
		disgox.RoleName(e.Client(), e.GuildID, *roles.CurrentRoleID),
	)

	if _, err := e.Client().Rest.CreateMessage(e.ChannelID, discord.MessageCreate{
		Content:          content,
		MessageReference: &discord.MessageReference{MessageID: &message.ID},
		AllowedMentions:  &discord.AllowedMentions{Users: []snowflake.ID{message.Author.ID}},
	}); err != nil {
		log.Error("failed to send activity role message", slog.Any("err", err))
	}
}

// addRoles gives a member the activity roles they've earned and don't have yet.
// held are the roles the member already has.
func (p *pointsGrant) addRoles(client *bot.Client, guildID, memberID snowflake.ID, held, earned []snowflake.ID, log *slog.Logger) {
	for _, roleID := range earned {
		if slices.Contains(held, roleID) {
			continue
		}

		if err := client.Rest.AddMemberRole(guildID, memberID, roleID,
			rest.WithReason("Automated Action - Member earned a chat activity role."),
		); err != nil {
			log.Error("failed to add activity role", slog.String("role_id", roleID.String()), slog.Any("err", err))
		}
	}
}

// grant grants chat activity points, creating the member's profile first if they don't have one.
func (p *pointsGrant) grant(ctx context.Context, guildID, memberID snowflake.ID) (database.ActivityGrant, error) {
	grant, err := p.db.Members.GrantActivityPoints(ctx, guildID, memberID, database.ActivityTypeChat)
	if !errors.Is(err, database.ErrMemberProfileNotFound) {
		return grant, err
	}

	if _, err := p.db.Members.CreateProfile(ctx, guildID, memberID); err != nil && !errors.Is(err, database.ErrMemberProfileExists) {
		return database.ActivityGrant{}, err
	}

	return p.db.Members.GrantActivityPoints(ctx, guildID, memberID, database.ActivityTypeChat)
}
