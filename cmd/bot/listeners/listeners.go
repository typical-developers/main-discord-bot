package listeners

import (
	"time"

	"github.com/disgoorg/disgo/bot"
	"github.com/disgoorg/disgo/handler"
	"github.com/typical-developers/main-discord-bot/internal/config"
	"github.com/typical-developers/main-discord-bot/internal/database"
)

// listenerTimeout bounds the database and API work done for a single gateway event.
const listenerTimeout = time.Second * 15

// Register adds every gateway listener to the client. Listeners that also handle interactions
// (such as the message embed menu) register their routes on r.
// Remember to enable the gateway intents a listener needs in cmd/bot/main.go.
//
// Events are handled concurrently, so listeners that keep state must guard it.
func Register(client *bot.Client, r handler.Router, cfg *config.Config, db *database.Database) {
	client.AddEventListeners(
		newGuildRegistrar(db),
		newPointsGrant(db),
		newMessageEmbeds(r, db),
		newGIFSpamPrevention(cfg),
		newCameraBlocker(cfg),
		newVoiceRooms(db),
	)
}
