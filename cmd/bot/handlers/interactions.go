package handlers

import (
	"fmt"
	"runtime/debug"

	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/handler"
	"github.com/typical-developers/main-discord-bot/internal/disgox"
)

// Recover turns a panic inside a handler into an error, so the user still gets a
// response and the panic is logged by the error handler.
func Recover(next handler.Handler) handler.Handler {
	return func(e *handler.InteractionEvent) (err error) {
		defer func() {
			if r := recover(); r != nil {
				err = fmt.Errorf("panic: %v\n%s", r, debug.Stack())
			}
		}()

		return next(e)
	}
}

// GuildOnly rejects interactions that did not happen inside a guild.
func GuildOnly(next handler.Handler) handler.Handler {
	return func(e *handler.InteractionEvent) error {
		if e.Interaction.GuildID() == nil {
			return disgox.UserErrorf("This can only be used inside a server.")
		}

		return next(e)
	}
}

// RequirePermissions rejects members missing any of the given permissions.
// Prefer DefaultMemberPermissions on the command itself; use this for routes
// Discord cannot gate, such as buttons and modals.
func RequirePermissions(perms discord.Permissions) handler.Middleware {
	return func(next handler.Handler) handler.Handler {
		return GuildOnly(func(e *handler.InteractionEvent) error {
			member := e.Interaction.Member()
			if member == nil || !member.Permissions.Has(perms) {
				return disgox.UserErrorf("You do not have permission to do that.")
			}

			return next(e)
		})
	}
}
