package listeners

import (
	"github.com/disgoorg/disgo/bot"
	"github.com/typical-developers/main-discord-bot/internal/database"
)

// Register adds every gateway listener to the client.
// Remember to enable the gateway intents a listener needs in cmd/bot/main.go.
func Register(client *bot.Client, db *database.Database) {
	client.AddEventListeners(
		newGuildRegistrar(db),
	)
}
