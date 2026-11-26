package listeners

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"slices"

	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/events"
	"github.com/disgoorg/disgo/rest"
	"github.com/disgoorg/snowflake/v2"
	"github.com/typical-developers/main-discord-bot/internal/database"
	"github.com/typical-developers/main-discord-bot/internal/database/gen"
	"github.com/typical-developers/main-discord-bot/internal/disgox"
	"github.com/typical-developers/main-discord-bot/internal/ptr"
)

// pointsGrant grants chat activity points for messages, hands out the activity roles
// members have earned, and congratulates them when they unlock a new one.
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

	profile, err := p.grant(ctx, e.GuildID, message.Author.ID)
	if err != nil {
		if errors.Is(err, database.ErrMemberOnGrantCooldown) || errors.Is(err, database.ErrActivityTrackingDisabled) {
			return
		}

		log.Error("failed to grant chat activity points", slog.Any("err", err))
		return
	}

	roles, err := p.db.Members.GetActivityRoleInfo(ctx, e.GuildID, database.ActivityTypeChat, profile.ChatActivity)
	if err != nil {
		log.Error("failed to get activity role info", slog.Any("err", err))
		return
	}

	for _, roleID := range roles.CurrentRolesIds {
		if slices.Contains(message.Member.RoleIDs, roleID) {
			continue
		}

		if err := e.Client().Rest.AddMemberRole(e.GuildID, message.Author.ID, roleID,
			rest.WithReason("Automated Action - Member earned a chat activity role."),
		); err != nil {
			log.Error("failed to add activity role", slog.String("role_id", roleID.String()), slog.Any("err", err))
		}
	}

	// the member unlocked a new role if they didn't have enough points for it before this grant.
	previousPoints := profile.ChatActivity - settings.GrantAmount
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

// grant grants chat activity points, creating the member's profile first if they don't have one.
func (p *pointsGrant) grant(ctx context.Context, guildID, memberID snowflake.ID) (gen.GuildProfile, error) {
	profile, err := p.db.Members.GrantActivityPoints(ctx, guildID, memberID, database.ActivityTypeChat)
	if !errors.Is(err, database.ErrMemberProfileNotFound) {
		return profile, err
	}

	if _, err := p.db.Members.CreateProfile(ctx, guildID, memberID); err != nil && !errors.Is(err, database.ErrMemberProfileExists) {
		return gen.GuildProfile{}, err
	}

	return p.db.Members.GrantActivityPoints(ctx, guildID, memberID, database.ActivityTypeChat)
}
