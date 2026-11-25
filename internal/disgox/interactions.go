package disgox

import (
	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/handler"
	"github.com/disgoorg/disgo/rest"
)

// ReplyEphemeral sends an ephemeral message, falling back to a follow-up when the
// interaction was already acknowledged (e.g. the handler deferred before failing).
func ReplyEphemeral(e *handler.InteractionEvent, content string) error {
	message := discord.MessageCreate{
		Content: content,
		Flags:   discord.MessageFlagEphemeral,
	}

	err := e.CreateMessage(message)
	if err == nil || !rest.IsJSONErrorCode(err, rest.JSONErrorCodeInteractionAlreadyAcknowledged) {
		return err
	}

	_, err = e.CreateFollowupMessage(message)
	return err
}

// InteractionName returns a readable identifier for an interaction, for use in logs.
func InteractionName(e *handler.InteractionEvent) string {
	switch i := e.Interaction.(type) {
	case discord.ApplicationCommandInteraction:
		return "command:" + i.Data.CommandName()
	case discord.AutocompleteInteraction:
		return "autocomplete:" + i.Data.CommandName
	case discord.ComponentInteraction:
		return "component:" + i.Data.CustomID()
	case discord.ModalSubmitInteraction:
		return "modal:" + i.Data.CustomID
	default:
		return "unknown"
	}
}
