// Package components handles buttons, select menus and modals that don't belong to a command,
// such as the panel posted in every voice room.
package components

import (
	"github.com/disgoorg/disgo/handler"
	"github.com/typical-developers/main-discord-bot/internal/config"
	"github.com/typical-developers/main-discord-bot/internal/database"
)

// Register registers every standalone component route. Routes use the full custom ID, e.g. "/voice-room/rename".
func Register(r handler.Router, cfg *config.Config, db *database.Database) {
	newVoiceRoomPanel(db).Register(r)
}
