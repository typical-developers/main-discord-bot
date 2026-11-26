package commands

import (
	"fmt"

	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/handler"
	"github.com/disgoorg/omit"
	"github.com/typical-developers/main-discord-bot/cmd/bot/handlers"
	"github.com/typical-developers/main-discord-bot/internal/disgox"
)

// maxSlowmode is the longest slowmode Discord allows, in seconds (6 hours).
const maxSlowmode = 21600

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
			discord.ApplicationCommandOptionInt{
				Name:        "duration",
				Description: "How long the slowmode should be, in seconds. Use 0 to disable it.",
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
	duration := data.Int("duration")
	if duration < 0 || duration > maxSlowmode {
		return disgox.UserErrorf("The duration must be between 0 and %d seconds.", maxSlowmode)
	}

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

	content := fmt.Sprintf("Successfully set the slowmode for <#%s> to %ds.", channelID, duration)
	if duration == 0 {
		content = fmt.Sprintf("Successfully disabled the slowmode for <#%s>.", channelID)
	}

	_, err := e.CreateFollowupMessage(discord.MessageCreate{Content: content})
	return err
}
