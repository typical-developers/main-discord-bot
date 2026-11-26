package commands

import (
	"fmt"
	"strings"
	"time"

	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/handler"
	"github.com/disgoorg/omit"
	"github.com/typical-developers/main-discord-bot/cmd/bot/handlers"
	"github.com/typical-developers/main-discord-bot/internal/disgox"
	"github.com/typical-developers/main-discord-bot/internal/timex"
)

// maxSlowmode is the longest slowmode Discord allows (6 hours).
const maxSlowmode = 6 * time.Hour

type slowmodeCommand struct{}

func newSlowmodeCommand() *slowmodeCommand {
	return &slowmodeCommand{}
}

func (c *slowmodeCommand) Create() discord.ApplicationCommandCreate {
	return discord.SlashCommandCreate{
		Name:                     "slowmode",
		Description:              "Set a slowmode for a channel.",
		DefaultMemberPermissions: omit.NewPtr(discord.PermissionManageMessages),
		Contexts:                 guildOnly,
		Options: []discord.ApplicationCommandOption{
			discord.ApplicationCommandOptionString{
				Name:        "duration",
				Description: "How long the slowmode should be (e.g. 30s, 5m, 1h 30m). Use 0 or off to disable it.",
				Required:    true,
			},
			discord.ApplicationCommandOptionChannel{
				Name:         "channel",
				Description:  "The channel to set the slowmode for. Defaults to the current channel.",
				ChannelTypes: []discord.ChannelType{discord.ChannelTypeGuildText},
			},
		},
	}
}

func (c *slowmodeCommand) Register(r handler.Router) {
	r.Use(handlers.GuildOnly)
	r.SlashCommand("/", c.slowmode)
}

func (c *slowmodeCommand) slowmode(data discord.SlashCommandInteractionData, e *handler.CommandEvent) error {
	parsed, err := parseSlowmodeDuration(data.String("duration"))
	if err != nil {
		return disgox.UserErrorf("Invalid duration. Use a format like `30s`, `5m` or `1h 30m`, or `0` to disable it.")
	}
	if parsed < 0 || parsed > maxSlowmode {
		return disgox.UserErrorf("The duration must be between 0s and %s.", timex.FormatDurationFromTime(time.Time{}, time.Time{}.Add(maxSlowmode)))
	}
	duration := int(parsed / time.Second)

	channelID := e.Channel().ID()
	if _, ok := data.OptChannel("channel"); ok {
		channelID = data.Snowflake("channel")
	}

	if channel, ok := e.Client().Caches.Channel(channelID); !ok || channel.Type() != discord.ChannelTypeGuildText {
		return disgox.UserErrorf("Unable to set the slowmode for <#%s>.", channelID)
	}

	if err := e.DeferCreateMessage(true); err != nil {
		return err
	}

	if _, err := e.Client().Rest.UpdateChannel(channelID, discord.GuildTextChannelUpdate{RateLimitPerUser: &duration}); err != nil {
		return disgox.WrapUserError(err, fmt.Sprintf("Unable to set the slowmode for <#%s>, do I have the correct permissions?", channelID))
	}

	content := fmt.Sprintf("Successfully set the slowmode for <#%s> to %s.", channelID, timex.FormatDurationFromTime(time.Time{}, time.Time{}.Add(parsed)))
	if duration == 0 {
		content = fmt.Sprintf("Successfully disabled the slowmode for <#%s>.", channelID)
	}

	_, err = e.CreateFollowupMessage(discord.MessageCreate{Content: content})
	return err
}

// parseSlowmodeDuration parses the duration option, treating "0" and "off" as disabling slowmode.
func parseSlowmodeDuration(input string) (time.Duration, error) {
	switch strings.TrimSpace(strings.ToLower(input)) {
	case "0", "off", "none", "disable":
		return 0, nil
	}

	d, err := timex.ParseDurationFromString(input)
	if err != nil {
		return 0, err
	}
	if d == nil {
		return 0, timex.ErrInvalidDuration
	}
	return *d, nil
}
