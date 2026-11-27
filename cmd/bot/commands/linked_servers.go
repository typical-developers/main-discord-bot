package commands

import (
	"errors"
	"fmt"
	"strings"

	"github.com/disgoorg/disgo/bot"
	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/handler"
	"github.com/disgoorg/disgo/rest"
	"github.com/disgoorg/omit"
	"github.com/disgoorg/snowflake/v2"
	"github.com/typical-developers/main-discord-bot/cmd/bot/handlers"
	"github.com/typical-developers/main-discord-bot/internal/database"
	"github.com/typical-developers/main-discord-bot/internal/disgox"
)

// linkedServersCommand links servers so their members' activity points count towards each other.
//
// Linked servers share all time points: the all time leaderboard, the points and rank on profile
// cards, and activity role requirements. Profiles, cooldowns and the daily, weekly, monthly and
// yearly leaderboards are still kept per server.
type linkedServersCommand struct {
	db *database.Database
}

func newLinkedServersCommand(db *database.Database) *linkedServersCommand {
	return &linkedServersCommand{db}
}

func (c *linkedServersCommand) Create() discord.ApplicationCommandCreate {
	return discord.SlashCommandCreate{
		Name:                     "linked-servers",
		Description:              "Manage the servers that share activity points with this server.",
		DefaultMemberPermissions: omit.NewPtr(discord.PermissionAdministrator),
		Contexts:                 guildOnly,
		Options: []discord.ApplicationCommandOption{
			discord.ApplicationCommandOptionSubCommand{
				Name:        "link",
				Description: "Link another server, so activity points from both count towards each other.",
				Options: []discord.ApplicationCommandOption{
					discord.ApplicationCommandOptionString{
						Name:        "server-id",
						Description: "The ID of the server to link. You must be an administrator there too.",
						Required:    true,
					},
				},
			},
			discord.ApplicationCommandOptionSubCommand{
				Name:        "unlink",
				Description: "Unlink this server from the servers it's linked to.",
			},
			discord.ApplicationCommandOptionSubCommand{
				Name:        "list",
				Description: "See the servers this server is linked to.",
			},
		},
	}
}

func (c *linkedServersCommand) Register(r handler.Router) {
	r.Use(handlers.GuildOnly)
	r.SlashCommand("/link", c.link)
	r.SlashCommand("/unlink", c.unlink)
	r.SlashCommand("/list", c.list)
}

func (c *linkedServersCommand) link(data discord.SlashCommandInteractionData, e *handler.CommandEvent) error {
	guildID := *e.GuildID()

	otherGuildID, err := snowflake.Parse(strings.TrimSpace(data.String("server-id")))
	if err != nil {
		return disgox.WrapUserError(err, "That is not a valid server ID.")
	}

	if otherGuildID == guildID {
		return disgox.UserErrorf("A server cannot be linked to itself.")
	}

	if err := e.DeferCreateMessage(true); err != nil {
		return err
	}

	if _, ok := e.Client().Caches.Guild(otherGuildID); !ok {
		return disgox.UserErrorf("I'm not in that server. Add me to it before linking it.")
	}

	// linking shares the other server's points too, so it needs the other server's permission.
	member, err := disgox.GetMember(e.Client(), otherGuildID, e.User().ID, rest.WithCtx(e.Ctx))
	if err != nil {
		return disgox.WrapUserError(err, "You must be a member of that server to link it.")
	}

	if !e.Client().Caches.MemberPermissions(member).Has(discord.PermissionAdministrator) {
		return disgox.UserErrorf("You must be an administrator in that server to link it.")
	}

	// the bot registers servers when it joins them, but the other server may have only just added it.
	if err := c.db.Guilds.EnsureRegistered(e.Ctx, otherGuildID); err != nil {
		return err
	}

	if err := c.db.Guilds.LinkGuilds(e.Ctx, guildID, otherGuildID); err != nil {
		if errors.Is(err, database.ErrGuildsAlreadyLinked) {
			return disgox.WrapUserError(err, fmt.Sprintf("This server is already linked to %s.", guildLabel(e.Client(), otherGuildID)))
		}

		return err
	}

	linked, err := c.db.Guilds.GetLinkedGuilds(e.Ctx, guildID)
	if err != nil {
		return err
	}

	ids := make([]snowflake.ID, len(linked))
	for i, link := range linked {
		ids[i] = link.GuildID
	}

	_, err = e.CreateFollowupMessage(discord.MessageCreate{
		Content: fmt.Sprintf(
			"Linked %s! Activity points from this server and these servers now count towards each other:\n%s\n\n"+
				"-# Members get any activity roles they've earned the next time they're granted points.",
			guildLabel(e.Client(), otherGuildID),
			guildList(e.Client(), ids),
		),
	})
	return err
}

func (c *linkedServersCommand) unlink(_ discord.SlashCommandInteractionData, e *handler.CommandEvent) error {
	guildID := *e.GuildID()

	if err := e.DeferCreateMessage(true); err != nil {
		return err
	}

	linked, err := c.db.Guilds.GetLinkedGuilds(e.Ctx, guildID)
	if err != nil {
		return err
	}

	if err := c.db.Guilds.UnlinkGuild(e.Ctx, guildID); err != nil {
		if errors.Is(err, database.ErrGuildNotLinked) {
			return disgox.WrapUserError(err, "This server is not linked to any other servers.")
		}

		return err
	}

	ids := make([]snowflake.ID, len(linked))
	for i, link := range linked {
		ids[i] = link.GuildID
	}

	_, err = e.CreateFollowupMessage(discord.MessageCreate{
		Content: fmt.Sprintf(
			"This server has been unlinked from:\n%s\n\n"+
				"-# Points earned in each server stay there. Activity roles that were earned with points from the other servers are not removed.",
			guildList(e.Client(), ids),
		),
	})
	return err
}

func (c *linkedServersCommand) list(_ discord.SlashCommandInteractionData, e *handler.CommandEvent) error {
	if err := e.DeferCreateMessage(true); err != nil {
		return err
	}

	linked, err := c.db.Guilds.GetLinkedGuilds(e.Ctx, *e.GuildID())
	if err != nil {
		return err
	}

	if len(linked) == 0 {
		_, err = e.CreateFollowupMessage(discord.MessageCreate{Content: "This server is not linked to any other servers."})
		return err
	}

	lines := make([]string, len(linked))
	for i, link := range linked {
		lines[i] = fmt.Sprintf("- %s, linked <t:%d:R>", guildLabel(e.Client(), link.GuildID), link.LinkedAt.Time.Unix())
	}

	_, err = e.CreateFollowupMessage(discord.MessageCreate{
		Content: "Activity points from these servers count towards this server's:\n" + strings.Join(lines, "\n"),
	})
	return err
}

// guildLabel names a server for a message, e.g. **Typical Developers** (`865737627712749579`).
// Servers that aren't cached (for example, ones the bot was removed from) are shown by ID only.
func guildLabel(client *bot.Client, guildID snowflake.ID) string {
	if guild, ok := client.Caches.Guild(guildID); ok {
		return fmt.Sprintf("**%s** (`%s`)", guild.Name, guildID)
	}

	return fmt.Sprintf("`%s`", guildID)
}

// guildList is a bulleted list of servers for a message.
func guildList(client *bot.Client, guildIDs []snowflake.ID) string {
	lines := make([]string, len(guildIDs))
	for i, id := range guildIDs {
		lines[i] = "- " + guildLabel(client, id)
	}

	return strings.Join(lines, "\n")
}
