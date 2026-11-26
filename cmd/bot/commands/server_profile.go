package commands

import (
	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/handler"
	"github.com/disgoorg/snowflake/v2"
	"github.com/typical-developers/main-discord-bot/cmd/bot/handlers"
	"github.com/typical-developers/main-discord-bot/internal/database"
	"github.com/typical-developers/main-discord-bot/internal/disgox"
	"github.com/typical-developers/main-discord-bot/internal/emojis"
)

// profileCards is shared by /server-profile and the "Get User's Profile" context menu.
type profileCards struct {
	db *database.Database
}

// send replies to a command with a member's profile card.
func (p *profileCards) send(e *handler.CommandEvent, memberID snowflake.ID) error {
	guildID := *e.GuildID()

	member, err := e.Client().Rest.GetMember(guildID, memberID)
	if err != nil {
		return disgox.WrapUserError(err, "Unable to fetch the member's details.")
	}

	if err := e.DeferCreateMessage(false); err != nil {
		return err
	}

	card, err := loadProfileCard(e.Ctx, e.Client(), p.db, guildID, *member)
	if err != nil {
		return err
	}

	file, err := profileCardFile(e.Ctx, card)
	if err != nil {
		return err
	}

	// only the member the card belongs to can refresh it.
	components := []discord.LayoutComponent{}
	if e.User().ID == memberID {
		components = append(components, p.refreshRow(memberID))
	}

	_, err = e.UpdateInteractionResponse(discord.MessageUpdate{
		Files: []*discord.File{file},
		// drops the previous card when the message is updated.
		Attachments: &[]discord.AttachmentUpdate{},
		Embeds:      &[]discord.Embed{},
		Components:  &components,
	})
	return err
}

// refresh handles the refresh button under a profile card.
func (p *profileCards) refresh(_ discord.ButtonInteractionData, e *handler.ComponentEvent) error {
	if e.Vars["user"] != e.User().ID.String() {
		return disgox.UserErrorf("This is not your profile card! Run the command yourself to see your own.")
	}

	if err := e.DeferUpdateMessage(); err != nil {
		return err
	}

	guildID := *e.GuildID()
	member, err := e.Client().Rest.GetMember(guildID, e.User().ID)
	if err != nil {
		return err
	}

	card, err := loadProfileCard(e.Ctx, e.Client(), p.db, guildID, *member)
	if err != nil {
		return err
	}

	file, err := profileCardFile(e.Ctx, card)
	if err != nil {
		return err
	}

	_, err = e.UpdateInteractionResponse(discord.MessageUpdate{
		Files: []*discord.File{file},
		// drops the previous card when the message is updated.
		Attachments: &[]discord.AttachmentUpdate{},
		Embeds:      &[]discord.Embed{},
		Components:  &[]discord.LayoutComponent{p.refreshRow(e.User().ID)},
	})
	return err
}

func (p *profileCards) refreshRow(memberID snowflake.ID) discord.ActionRowComponent {
	return discord.NewActionRow(
		discord.NewSecondaryButton("", "/server-profile/refresh/"+memberID.String()).
			WithEmoji(emojis.Component(emojis.EmojiRefresh)),
	)
}

type serverProfileCommand struct {
	cards *profileCards
}

func newServerProfileCommand(db *database.Database) *serverProfileCommand {
	return &serverProfileCommand{&profileCards{db}}
}

func (c *serverProfileCommand) Create() discord.ApplicationCommandCreate {
	return discord.SlashCommandCreate{
		Name:        "server-profile",
		Description: "Get information on a server member!",
		Contexts:    guildOnly,
		Options: []discord.ApplicationCommandOption{
			discord.ApplicationCommandOptionUser{
				Name:        "user",
				Description: "The member you'd like to see the profile of. Defaults to you.",
			},
		},
	}
}

func (c *serverProfileCommand) Register(r handler.Router) {
	r.Use(handlers.GuildOnly)
	r.SlashCommand("/", c.profile)
	r.ButtonComponent("/refresh/{user}", c.cards.refresh)
}

func (c *serverProfileCommand) profile(data discord.SlashCommandInteractionData, e *handler.CommandEvent) error {
	memberID := e.User().ID
	if user, ok := data.OptUser("user"); ok {
		memberID = user.ID
	}

	return c.cards.send(e, memberID)
}

type userProfileMenuCommand struct {
	cards *profileCards
}

func newUserProfileMenuCommand(db *database.Database) *userProfileMenuCommand {
	return &userProfileMenuCommand{&profileCards{db}}
}

func (c *userProfileMenuCommand) Create() discord.ApplicationCommandCreate {
	return discord.UserCommandCreate{
		Name:     "Get User's Profile",
		Contexts: guildOnly,
	}
}

func (c *userProfileMenuCommand) Register(r handler.Router) {
	r.Use(handlers.GuildOnly)
	r.UserCommand("/", c.profile)
}

func (c *userProfileMenuCommand) profile(data discord.UserCommandInteractionData, e *handler.CommandEvent) error {
	return c.cards.send(e, data.TargetUser().ID)
}
