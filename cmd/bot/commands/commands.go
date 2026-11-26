package commands

import (
	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/handler"
	"github.com/disgoorg/snowflake/v2"
	"github.com/typical-developers/main-discord-bot/internal/config"
	"github.com/typical-developers/main-discord-bot/internal/database"
)

// Command is an application command and the handlers behind it.
type Command interface {
	// Create returns the command definition sent to Discord.
	Create() discord.ApplicationCommandCreate

	// Register registers the command's handlers. The router is already scoped to
	// "/<command name>", so the command itself is "/" and subcommands are "/<subcommand>".
	// Components and modals can be registered here too, e.g. a button with the
	// custom ID "/<command name>/confirm" is registered as "/confirm".
	Register(r handler.Router)
}

// guildOnly is the context used by every command that only makes sense inside a server.
var guildOnly = []discord.InteractionContextType{
	discord.InteractionContextTypeGuild,
}

// GlobalCommands returns the commands available in every guild.
func GlobalCommands(cfg *config.Config, db *database.Database) []Command {
	// /server-profile and the "Get User's Profile" context menu draw the same card, so they
	// share its image cache.
	profileCards := newProfileCards(db)

	return []Command{
		// moderation
		newSlowmodeCommand(),

		// server
		newServerProfileCommand(profileCards),
		newUserProfileMenuCommand(profileCards),
		newServerLeaderboardCommand(db),
		newMigrateMemberProfileCommand(cfg, db),

		// server settings
		newChatActivityCommand(db),
		newMessageEmbedsCommand(db),
		newVoiceRoomLobbyCommand(db),
	}
}

// GuildCommands returns the commands limited to specific guilds, keyed by guild ID.
func GuildCommands(cfg *config.Config, db *database.Database) map[snowflake.ID][]Command {
	return map[snowflake.ID][]Command{
		// cfg.SomeGuildID: {
		// 	newSomeGuildCommand(db),
		// },
	}
}
