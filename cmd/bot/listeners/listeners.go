package listeners

import (
	"time"

	"github.com/disgoorg/disgo/bot"
	"github.com/typical-developers/main-discord-bot/internal/config"
	"github.com/typical-developers/main-discord-bot/internal/database"
)

// listenerTimeout bounds the database and API work done for a single gateway event.
const listenerTimeout = time.Second * 15

// Register adds every gateway listener to the client.
// Remember to enable the gateway intents a listener needs in cmd/bot/main.go.
//
// Events are handled concurrently, so listeners that keep state must guard it.
func Register(client *bot.Client, cfg *config.Config, db *database.Database) {
	client.AddEventListeners(
		newGuildRegistrar(db),
		newPointsGrant(db),
		newMessageEmbeds(db),
		newGIFSpamPrevention(cfg),
		newCameraBlocker(cfg),
		newVoiceRooms(db),
	)
}
