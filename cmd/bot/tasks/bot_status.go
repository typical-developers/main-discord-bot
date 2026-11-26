package tasks

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/disgoorg/disgo/bot"
	"github.com/disgoorg/disgo/gateway"
	"github.com/luckfire/goblox/legacy"
	"github.com/typical-developers/main-discord-bot/common"
)

// robloxRequestTimeout bounds a single player count lookup, so a slow Roblox API can't stall the status cycle.
const robloxRequestTimeout = time.Second * 10

// botStatus cycles the bot's status through the player counts of our Roblox experiences.
type botStatus struct {
	client *bot.Client
	roblox *legacy.Client

	// only accessed from run, which never runs concurrently.
	next    int
	current string
}

func newBotStatus(client *bot.Client, roblox *legacy.Client) *botStatus {
	return &botStatus{client: client, roblox: roblox}
}

func (b *botStatus) run(ctx context.Context) {
	experience := common.StatusExperiences[b.next]
	b.next = (b.next + 1) % len(common.StatusExperiences)

	playing, err := b.playing(ctx, experience.UniverseID)
	if err != nil {
		slog.Debug("failed to fetch player count", slog.String("experience", experience.Name), slog.Any("err", err))
		return
	}

	// keep the previous status rather than showing an empty experience.
	if playing <= 0 {
		return
	}

	status := fmt.Sprintf("%s・%d playing", experience.Name, playing)
	if status == b.current {
		return
	}

	if err := b.client.SetPresence(ctx, gateway.WithCustomActivity(status)); err != nil {
		slog.Debug("failed to set presence", slog.Any("err", err))
		return
	}

	b.current = status
}

// playing returns how many players are in a Roblox experience.
func (b *botStatus) playing(ctx context.Context, universeID int64) (int64, error) {
	ctx, cancel := context.WithTimeout(ctx, robloxRequestTimeout)
	defer cancel()

	games, _, err := b.roblox.Games.GetGames(ctx, &legacy.GetGamesOptions{
		UniverseIDs: []int64{universeID},
	})
	if err != nil {
		return 0, err
	}

	for _, game := range games {
		if game.ID == universeID {
			return game.Playing, nil
		}
	}

	return 0, fmt.Errorf("universe %d was not returned", universeID)
}
