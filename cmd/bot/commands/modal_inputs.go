package commands

import (
	"strconv"
	"strings"

	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/snowflake/v2"
	"github.com/typical-developers/main-discord-bot/internal/disgox"
)

// maxSelectValues is the most values Discord lets a select menu hold.
const maxSelectValues = 25

// modalCheckbox reports whether the checkbox with the custom ID was ticked.
func modalCheckbox(data discord.ModalSubmitInteractionData, customID string) bool {
	component, ok := data.Component(customID)
	if !ok {
		return false
	}

	checkbox, ok := component.(discord.CheckboxComponent)
	return ok && checkbox.Value
}

// modalCheckboxGroup returns the values ticked in the checkbox group with the custom ID.
func modalCheckboxGroup(data discord.ModalSubmitInteractionData, customID string) []string {
	component, ok := data.Component(customID)
	if !ok {
		return nil
	}

	group, ok := component.(discord.CheckboxGroupComponent)
	if !ok {
		return nil
	}

	return group.Values
}

// modalRoleIDs returns the roles picked in the role select with the custom ID. It's never nil, so an
// empty selection clears the setting it's saved to.
func modalRoleIDs(data discord.ModalSubmitInteractionData, customID string) []snowflake.ID {
	ids := []snowflake.ID{}
	if menu, ok := data.RoleSelectMenu(customID); ok {
		ids = append(ids, menu.Values...)
	}

	return ids
}

// modalChannelIDs returns the channels picked in the channel select with the custom ID. It's never nil,
// so an empty selection clears the setting it's saved to.
func modalChannelIDs(data discord.ModalSubmitInteractionData, customID string) []snowflake.ID {
	ids := []snowflake.ID{}
	if menu, ok := data.ChannelSelectMenu(customID); ok {
		ids = append(ids, menu.Values...)
	}

	return ids
}

// modalInt parses the whole number typed into the text input with the custom ID, which must be
// between minValue and maxValue. name is how the input is referred to in error messages.
func modalInt(data discord.ModalSubmitInteractionData, customID, name string, minValue, maxValue int64) (int64, error) {
	value, err := strconv.ParseInt(strings.TrimSpace(data.Text(customID)), 10, 64)
	if err != nil {
		return 0, disgox.UserErrorf("The %s must be a whole number.", name)
	}

	if value < minValue || value > maxValue {
		return 0, disgox.UserErrorf("The %s must be between %d and %d.", name, minValue, maxValue)
	}

	return value, nil
}
