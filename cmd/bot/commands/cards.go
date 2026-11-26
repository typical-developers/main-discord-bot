package commands

// Profile and leaderboard cards are drawn as images by internal/render.
//
// Loading the data is kept separate from drawing it: load* gathers what's shown from the
// database and Discord, and *File turns it into a PNG attachment.

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"image"
	"image/color"
	"log/slog"
	"sync"
	"time"

	"github.com/disgoorg/disgo/bot"
	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/rest"
	"github.com/disgoorg/snowflake/v2"
	"github.com/typical-developers/main-discord-bot/internal/database"
	"github.com/typical-developers/main-discord-bot/internal/disgox"
	"github.com/typical-developers/main-discord-bot/internal/render"
)

const (
	leaderboardPageSize = 15

	// how many leaderboard members are looked up at once.
	leaderboardLookups = 5
)

// cardImageOpts asks Discord for a PNG big enough for the card at 2x.
var cardImageOpts = []discord.CDNOpt{discord.WithSize(256), discord.WithFormat(discord.FileFormatPNG)}

type profileCard struct {
	DisplayName string
	Username    string
	AvatarURL   string

	Points      int32
	AllTimeRank int64
	// 0 when the member has no points on that leaderboard.
	WeeklyRank  int32
	MonthlyRank int32

	// nil when the member hasn't earned an activity role yet.
	CurrentRole *profileCardRole
	// nil when there's no higher activity role to earn.
	NextRole *profileCardProgress
}

type profileCardRole struct {
	Name string
	// 0 when the role has no colour.
	Color int
	// empty when the role has no icon.
	IconURL        string
	RequiredPoints int32
}

// profileCardProgress is the progress from the current activity role to the next one.
type profileCardProgress struct {
	Current  int32
	Required int32
}

// loadProfileCard gathers everything shown on a member's chat activity profile card.
func loadProfileCard(ctx context.Context, client *bot.Client, db *database.Database, guildID snowflake.ID, member discord.Member) (profileCard, error) {
	settings, err := db.Guilds.GetActivitySettings(ctx, guildID, database.ActivityTypeChat)
	if err != nil {
		return profileCard{}, err
	}

	if !settings.IsEnabled {
		return profileCard{}, disgox.UserErrorf("Chat activity tracking is not enabled for this server.")
	}

	profile, err := db.Members.GetProfile(ctx, guildID, member.User.ID)
	if err != nil {
		if errors.Is(err, database.ErrMemberProfileNotFound) {
			return profileCard{}, disgox.WrapUserError(err, fmt.Sprintf("<@%s> does not have a profile yet.", member.User.ID))
		}

		return profileCard{}, err
	}

	roleInfo, err := db.Members.GetActivityRoleInfo(ctx, guildID, database.ActivityTypeChat, profile.ChatActivity)
	if err != nil {
		return profileCard{}, err
	}

	rankings, err := db.Leaderboards.GetMemberRankings(ctx, guildID, member.User.ID, database.ActivityTypeChat)
	if err != nil {
		return profileCard{}, err
	}

	card := profileCard{
		DisplayName: member.EffectiveName(),
		Username:    member.User.Username,
		AvatarURL:   member.EffectiveAvatarURL(cardImageOpts...),
		Points:      profile.ChatActivity,
		AllTimeRank: profile.ChatActivityRank,
		WeeklyRank:  rankings.WeeklyLeaderboardRank.Int32,
		MonthlyRank: rankings.MonthlyLeaderboardRank.Int32,
	}

	if roleInfo.CurrentRoleID != nil {
		card.CurrentRole = &profileCardRole{
			Name:           disgox.RoleName(client, guildID, *roleInfo.CurrentRoleID),
			RequiredPoints: roleInfo.CurrentRoleRequiredPoints.Int32,
		}

		if role, ok := client.Caches.Role(guildID, *roleInfo.CurrentRoleID); ok {
			card.CurrentRole.Color = role.Color
			if icon := role.IconURL(discord.WithSize(64), discord.WithFormat(discord.FileFormatPNG)); icon != nil {
				card.CurrentRole.IconURL = *icon
			}
		}
	}

	if roleInfo.NextRoleID != nil {
		// progress is counted from the current role, or from 0 when there isn't one.
		base := roleInfo.CurrentRoleRequiredPoints.Int32
		card.NextRole = &profileCardProgress{
			Current:  profile.ChatActivity - base,
			Required: roleInfo.NextRoleRequiredPoints.Int32 - base,
		}
	}

	return card, nil
}

// profileCardFile draws a profile card as a PNG attachment.
func profileCardFile(ctx context.Context, card profileCard) (*discord.File, error) {
	fonts, err := render.DefaultFonts()
	if err != nil {
		return nil, err
	}

	// the images are fetched together.
	var avatar, roleIcon image.Image
	var wg sync.WaitGroup
	wg.Go(func() { avatar = fetchCardImage(ctx, card.AvatarURL) })
	if card.CurrentRole != nil {
		wg.Go(func() { roleIcon = fetchCardImage(ctx, card.CurrentRole.IconURL) })
	}
	wg.Wait()

	r := render.ProfileCard{
		Avatar:      avatar,
		DisplayName: card.DisplayName,
		Username:    card.Username,
		Chat: render.ActivityStats{
			Points:      int(card.Points),
			AllTimeRank: int(card.AllTimeRank),
			WeeklyRank:  int(card.WeeklyRank),
			MonthlyRank: int(card.MonthlyRank),
		},
	}

	if card.CurrentRole != nil {
		r.ChatRole = &render.ProfileRole{Name: card.CurrentRole.Name, Icon: roleIcon}
		if c := card.CurrentRole.Color; c != 0 {
			r.ChatRole.Color = color.RGBA{uint8(c >> 16), uint8(c >> 8), uint8(c), 255}
		}
	}

	if card.NextRole != nil {
		r.Chat.Progress = &render.Progress{Current: int(card.NextRole.Current), Required: int(card.NextRole.Required)}
	}

	b, err := render.PNG(r, fonts, render.Scale)
	if err != nil {
		return nil, err
	}

	return discord.NewFile("profile-card.png", "", bytes.NewReader(b)), nil
}

type leaderboardCard struct {
	GuildName string
	GuildIcon string

	ActivityType database.ActivityType
	Period       database.TimePeriod
	Page         database.LeaderboardPage
	// the members on the page, by ID.
	Members map[snowflake.ID]leaderboardMember
}

type leaderboardMember struct {
	Username  string
	AvatarURL string
}

// loadLeaderboardCard gathers a page of a guild's activity leaderboard.
func loadLeaderboardCard(ctx context.Context, client *bot.Client, db *database.Database, guildID snowflake.ID, activityType database.ActivityType, period database.TimePeriod, page int) (leaderboardCard, error) {
	settings, err := db.Guilds.GetActivitySettings(ctx, guildID, activityType)
	if err != nil {
		return leaderboardCard{}, err
	}

	if !settings.IsEnabled {
		return leaderboardCard{}, disgox.UserErrorf("%s activity tracking is not enabled for this server.", activityTypeName(activityType))
	}

	lb, err := db.Leaderboards.GetPage(ctx, guildID, activityType, period, int32(page), leaderboardPageSize)
	if err != nil {
		return leaderboardCard{}, err
	}

	if len(lb.Entries) == 0 {
		return leaderboardCard{}, disgox.UserErrorf("The leaderboard currently has no rows.")
	}

	card := leaderboardCard{
		ActivityType: activityType,
		Period:       period,
		Page:         lb,
		Members:      leaderboardMembers(ctx, client, guildID, lb.Entries),
	}

	if guild, ok := client.Caches.Guild(guildID); ok {
		card.GuildName = guild.Name
		if icon := guild.IconURL(cardImageOpts...); icon != nil {
			card.GuildIcon = *icon
		}
	}

	return card, nil
}

// leaderboardMembers looks up the username and avatar of everyone on a leaderboard page, from
// disgo's member cache where possible. Members who left the server are looked up as users, and
// anyone who can't be found (for example, deleted accounts) is left out.
func leaderboardMembers(ctx context.Context, client *bot.Client, guildID snowflake.ID, entries []database.LeaderboardEntry) map[snowflake.ID]leaderboardMember {
	avatarOpts := []discord.CDNOpt{discord.WithSize(64), discord.WithFormat(discord.FileFormatPNG)}

	var (
		mu      sync.Mutex
		members = make(map[snowflake.ID]leaderboardMember, len(entries))
		wg      sync.WaitGroup
		slots   = make(chan struct{}, leaderboardLookups)
	)

	for _, entry := range entries {
		if member, ok := client.Caches.Member(guildID, entry.MemberID); ok {
			members[entry.MemberID] = leaderboardMember{
				Username:  member.User.Username,
				AvatarURL: member.EffectiveAvatarURL(avatarOpts...),
			}
			continue
		}

		wg.Go(func() {
			slots <- struct{}{}
			defer func() { <-slots }()

			var member leaderboardMember
			if m, err := disgox.GetMember(client, guildID, entry.MemberID, rest.WithCtx(ctx)); err == nil {
				member = leaderboardMember{Username: m.User.Username, AvatarURL: m.EffectiveAvatarURL(avatarOpts...)}
			} else if user, err := client.Rest.GetUser(entry.MemberID, rest.WithCtx(ctx)); err == nil {
				member = leaderboardMember{Username: user.Username, AvatarURL: user.EffectiveAvatarURL(avatarOpts...)}
			} else {
				return
			}

			mu.Lock()
			members[entry.MemberID] = member
			mu.Unlock()
		})
	}

	wg.Wait()
	return members
}

// leaderboardCardFile draws a leaderboard page as a PNG attachment.
func leaderboardCardFile(ctx context.Context, card leaderboardCard) (*discord.File, error) {
	fonts, err := render.DefaultFonts()
	if err != nil {
		return nil, err
	}

	periodText, resetsIn := leaderboardPeriod(card.Period, time.Now())
	r := render.LeaderboardCard{
		GuildName:  card.GuildName,
		Period:     periodText,
		ResetsIn:   resetsIn,
		ValueLabel: "Points",
		Rows:       make([]render.LeaderboardRow, len(card.Page.Entries)),
	}

	// the server icon and every member's avatar are fetched together.
	var wg sync.WaitGroup
	wg.Go(func() { r.GuildIcon = fetchCardImage(ctx, card.GuildIcon) })

	for i, entry := range card.Page.Entries {
		member, ok := card.Members[entry.MemberID]
		if !ok {
			member.Username = "Unknown User"
		}

		r.Rows[i] = render.LeaderboardRow{
			Rank:  int(entry.Rank),
			Name:  "@" + member.Username,
			Value: int(entry.Points),
		}
		if member.AvatarURL != "" {
			wg.Go(func() { r.Rows[i].Avatar = fetchCardImage(ctx, member.AvatarURL) })
		}
	}
	wg.Wait()

	b, err := render.PNG(r, fonts, render.Scale)
	if err != nil {
		return nil, err
	}

	return discord.NewFile("server-leaderboard.png", "", bytes.NewReader(b)), nil
}

// leaderboardPeriod describes a leaderboard's period for its card, and how long is left until it
// resets. Weekly and monthly leaderboards reset at the start of each week (Monday) and month in
// UTC, the same as the reset task.
func leaderboardPeriod(period database.TimePeriod, now time.Time) (text string, resetsIn string) {
	now = now.UTC()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)

	var label string
	var start, end time.Time
	switch period {
	case database.TimePeriodWeekly:
		label = "This Week"
		start = today.AddDate(0, 0, -((int(today.Weekday()) + 6) % 7))
		end = start.AddDate(0, 0, 7)
	case database.TimePeriodMonthly:
		label = "This Month"
		start = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
		end = start.AddDate(0, 1, 0)
	default:
		return "All Time", ""
	}

	const date = "01/02/2006"
	text = fmt.Sprintf("%s (%s - %s)", label, start.Format(date), end.AddDate(0, 0, -1).Format(date))

	left := end.Sub(now)
	days := int(left / (24 * time.Hour))
	hours := int(left/time.Hour) % 24
	minutes := int(left/time.Minute) % 60
	resetsIn = fmt.Sprintf("%02dd %02dh %02dm", days, hours, minutes)

	return text, resetsIn
}

// Downloaded avatars and icons are remembered for a while, since leaderboard pages are paginated
// and refreshed a lot (disgo caches members, not their images). Avatar and icon URLs contain a hash
// of the image, so a changed avatar is a different URL and is fetched straight away.
var cardImages = newTTLCache[string, image.Image](time.Minute*30, 150)

// ttlCache is a small, size-bounded cache whose entries expire after ttl. Safe for concurrent use.
type ttlCache[K comparable, V any] struct {
	ttl time.Duration
	max int

	mu      sync.Mutex
	entries map[K]ttlEntry[V]
}

type ttlEntry[V any] struct {
	value   V
	expires time.Time
}

func newTTLCache[K comparable, V any](ttl time.Duration, max int) *ttlCache[K, V] {
	return &ttlCache[K, V]{ttl: ttl, max: max, entries: make(map[K]ttlEntry[V])}
}

func (c *ttlCache[K, V]) get(key K) (V, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	entry, ok := c.entries[key]
	if !ok || time.Now().After(entry.expires) {
		var zero V
		return zero, false
	}

	return entry.value, true
}

func (c *ttlCache[K, V]) set(key K, value V) {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now()
	if len(c.entries) >= c.max {
		// drop expired entries first, then arbitrary ones if it's still full.
		for k, entry := range c.entries {
			if now.After(entry.expires) {
				delete(c.entries, k)
			}
		}
		for k := range c.entries {
			if len(c.entries) < c.max {
				break
			}
			delete(c.entries, k)
		}
	}

	c.entries[key] = ttlEntry[V]{value: value, expires: now.Add(c.ttl)}
}

// fetchCardImage downloads an image for a card. A card is still drawn without it (with a
// placeholder), so failures are only logged.
func fetchCardImage(ctx context.Context, url string) image.Image {
	if url == "" {
		return nil
	}

	if img, ok := cardImages.get(url); ok {
		return img
	}

	img, err := render.FetchImage(ctx, url)
	if err != nil {
		slog.Warn("failed to fetch card image", slog.String("url", url), slog.Any("err", err))
		return nil
	}

	cardImages.set(url, img)
	return img
}

func activityTypeName(activityType database.ActivityType) string {
	switch activityType {
	case database.ActivityTypeVoice:
		return "Voice"
	default:
		return "Chat"
	}
}
