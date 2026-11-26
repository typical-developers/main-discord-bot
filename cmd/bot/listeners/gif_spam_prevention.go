package listeners

import (
	"log/slog"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/events"
	"github.com/disgoorg/snowflake/v2"
	"github.com/typical-developers/main-discord-bot/internal/config"
)

// gifLinkRegex matches links to GIF hosts and links to .gif or .webp files.
var gifLinkRegex = regexp.MustCompile(`(?i)https?://(www\.)?((tenor|klipy|giphy)\S+|\S+\.(gif|webp))`)

// gifSpamPrevention deletes GIFs in a channel once too many were sent within the cooldown.
// Only channels (and their threads) inside the configured categories are covered.
type gifSpamPrevention struct {
	categoryIDs []snowflake.ID
	cooldown    time.Duration
	maxGIFs     int

	mu sync.Mutex
	// when recent GIFs were sent, per channel.
	recent map[snowflake.ID][]time.Time
}

func newGIFSpamPrevention(cfg *config.Config) *events.ListenerAdapter {
	g := &gifSpamPrevention{
		categoryIDs: cfg.Moderation.GIFSpamCategoryIDs,
		cooldown:    cfg.Moderation.GIFSpamCooldown,
		maxGIFs:     cfg.Moderation.GIFSpamMaxMessages,
		recent:      make(map[snowflake.ID][]time.Time),
	}

	return &events.ListenerAdapter{
		OnGuildMessageCreate: g.guildMessageCreate,
	}
}

func (g *gifSpamPrevention) guildMessageCreate(e *events.GuildMessageCreate) {
	if len(g.categoryIDs) == 0 || !g.inCoveredCategory(e) || !messageHasGIF(e.Message) {
		return
	}

	if g.allow(e.ChannelID, time.Now()) {
		return
	}

	if err := e.Client().Rest.DeleteMessage(e.ChannelID, e.Message.ID); err != nil {
		slog.Error("failed to delete GIF spam",
			slog.String("channel_id", e.ChannelID.String()),
			slog.Any("err", err),
		)
	}
}

// allow records a GIF in the channel, or reports false if the channel is already at its limit.
// Deleted GIFs are not recorded.
func (g *gifSpamPrevention) allow(channelID snowflake.ID, now time.Time) bool {
	g.mu.Lock()
	defer g.mu.Unlock()

	cutoff := now.Add(-g.cooldown)
	recent := slices.DeleteFunc(g.recent[channelID], func(t time.Time) bool { return !t.After(cutoff) })

	if len(recent) >= g.maxGIFs {
		g.recent[channelID] = recent
		return false
	}

	for id, times := range g.recent {
		if id != channelID && (len(times) == 0 || !times[len(times)-1].After(cutoff)) {
			delete(g.recent, id)
		}
	}

	g.recent[channelID] = append(recent, now)
	return true
}

// inCoveredCategory reports whether the message's channel, or a thread's parent channel,
// is inside one of the configured categories.
func (g *gifSpamPrevention) inCoveredCategory(e *events.GuildMessageCreate) bool {
	channel, ok := e.Client().Caches.Channel(e.ChannelID)
	if !ok {
		return false
	}

	if thread, ok := channel.(discord.GuildThread); ok {
		if channel, ok = e.Client().Caches.Channel(*thread.ParentID()); !ok {
			return false
		}
	}

	categoryID := channel.ParentID()
	return categoryID != nil && slices.Contains(g.categoryIDs, *categoryID)
}

func messageHasGIF(message discord.Message) bool {
	for _, sticker := range message.StickerItems {
		switch sticker.FormatType {
		case discord.StickerFormatTypeAPNG, discord.StickerFormatTypeLottie, discord.StickerFormatTypeGIF:
			return true
		}
	}

	for _, attachment := range message.Attachments {
		if attachment.ContentType == nil {
			continue
		}

		contentType, _, _ := strings.Cut(strings.ToLower(*attachment.ContentType), ";")
		if strings.TrimSpace(contentType) == "image/gif" {
			return true
		}
	}

	return gifLinkRegex.MatchString(message.Content)
}
