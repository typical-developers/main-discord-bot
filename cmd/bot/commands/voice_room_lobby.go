package commands

import (
	"cmp"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/handler"
	"github.com/disgoorg/omit"
	"github.com/disgoorg/snowflake/v2"
	"github.com/typical-developers/main-discord-bot/cmd/bot/handlers"
	"github.com/typical-developers/main-discord-bot/internal/database"
	"github.com/typical-developers/main-discord-bot/internal/database/gen"
	"github.com/typical-developers/main-discord-bot/internal/disgox"
)

const (
	// Discord's highest user limit for voice channels. 0 means no limit.
	maxVoiceUserLimit = 99

	// Discord shows at most 25 autocomplete choices.
	maxAutocompleteChoices = 25

	lobbyAddID    = "/voice-room-lobby/add/%s"
	lobbyUpdateID = "/voice-room-lobby/update/%s"

	lobbyUserLimitInput   = "user_limit"
	lobbyPermissionsInput = "permissions"

	lobbyCanRename      = "rename"
	lobbyCanLock        = "lock"
	lobbyCanAdjustLimit = "adjust_limit"
)

type voiceRoomLobbyCommand struct {
	db *database.Database
}

func newVoiceRoomLobbyCommand(db *database.Database) *voiceRoomLobbyCommand {
	return &voiceRoomLobbyCommand{db}
}

func (c *voiceRoomLobbyCommand) Create() discord.ApplicationCommandCreate {
	channelOption := discord.ApplicationCommandOptionString{
		Name:         "channel",
		Description:  "The channel that will be considered the lobby.",
		Required:     true,
		Autocomplete: true,
	}

	return discord.SlashCommandCreate{
		Name:                     "voice-room-lobby",
		Description:              "Manage voice room lobby settings.",
		DefaultMemberPermissions: omit.NewPtr(discord.PermissionAdministrator),
		Contexts:                 guildOnly,
		Options: []discord.ApplicationCommandOption{
			discord.ApplicationCommandOptionSubCommand{
				Name:        "add",
				Description: "Create a new lobby for creating voice rooms.",
				Options:     []discord.ApplicationCommandOption{channelOption},
			},
			discord.ApplicationCommandOptionSubCommand{
				Name:        "update",
				Description: "Update a lobby for creating voice rooms.",
				Options:     []discord.ApplicationCommandOption{channelOption},
			},
			discord.ApplicationCommandOptionSubCommand{
				Name:        "remove",
				Description: "Remove a lobby for creating voice rooms.",
				Options:     []discord.ApplicationCommandOption{channelOption},
			},
		},
	}
}

func (c *voiceRoomLobbyCommand) Register(r handler.Router) {
	r.Use(handlers.GuildOnly)

	r.SlashCommand("/add", c.add)
	r.SlashCommand("/update", c.update)
	r.SlashCommand("/remove", c.remove)

	r.Autocomplete("/add", c.autocompleteChannels)
	r.Autocomplete("/update", c.autocompleteLobbies)
	r.Autocomplete("/remove", c.autocompleteLobbies)

	r.Group(func(r handler.Router) {
		// Discord only gates the command itself, so the modals are checked here too.
		r.Use(handlers.RequirePermissions(discord.PermissionAdministrator))
		r.Modal("/add/{channel}", c.addSubmit)
		r.Modal("/update/{channel}", c.updateSubmit)
	})
}

// lobbySettingsModal builds the lobby settings modal, filled in with the given settings.
func lobbySettingsModal(customID, title string, lobby gen.GuildVoiceRoomsSetting) discord.ModalCreate {
	permission := func(value, label string, allowed bool) discord.CheckboxGroupOption {
		return discord.NewCheckboxGroupOption(value, label).WithDefault(allowed)
	}

	return discord.NewModalCreate(customID, title).
		AddComponents(
			discord.NewLabel("User Limit",
				discord.NewShortTextInput(lobbyUserLimitInput).
					WithValue(fmt.Sprint(lobby.UserLimit)).
					WithPlaceholder(fmt.Sprintf("0 to %d", maxVoiceUserLimit)).
					WithMaxLength(2).
					WithRequired(true),
			).WithDescription("How many users can join a created voice room. 0 means no limit."),
			discord.NewLabel("Room Owners Can",
				discord.CheckboxGroupComponent{}.
					WithCustomID(lobbyPermissionsInput).
					WithOptions(
						permission(lobbyCanRename, "Rename the room", lobby.CanRename),
						permission(lobbyCanLock, "Lock the room", lobby.CanLock),
						permission(lobbyCanAdjustLimit, "Adjust the user limit", lobby.CanAdjustLimit),
					).
					WithMinValues(0).
					WithRequired(false),
			).WithDescription("What the owner of a created voice room is allowed to change."),
		)
}

// lobbySettings reads the settings modal. Every field is set, since the modal always has all of them.
func lobbySettings(data discord.ModalSubmitInteractionData) (database.VoiceRoomLobbySettings, error) {
	limit, err := modalInt(data, lobbyUserLimitInput, "user limit", 0, maxVoiceUserLimit)
	if err != nil {
		return database.VoiceRoomLobbySettings{}, err
	}

	permissions := modalCheckboxGroup(data, lobbyPermissionsInput)

	return database.VoiceRoomLobbySettings{
		UserLimit:      new(int32(limit)),
		CanRename:      new(slices.Contains(permissions, lobbyCanRename)),
		CanLock:        new(slices.Contains(permissions, lobbyCanLock)),
		CanAdjustLimit: new(slices.Contains(permissions, lobbyCanAdjustLimit)),
	}, nil
}

// modalChannelID returns the lobby's channel ID from the modal's custom ID.
func modalChannelID(e *handler.ModalEvent) (snowflake.ID, error) {
	channelID, err := snowflake.Parse(e.Vars["channel"])
	if err != nil {
		return 0, disgox.UserErrorf("The channel you specified does not exist.")
	}

	return channelID, nil
}

// voiceChannelOption returns the voice channel picked in the "channel" option.
func voiceChannelOption(data discord.SlashCommandInteractionData, e *handler.CommandEvent) (discord.GuildChannel, error) {
	notFound := disgox.UserErrorf("The channel you specified does not exist.")

	channelID, err := snowflake.Parse(data.String("channel"))
	if err != nil {
		return nil, notFound
	}

	channel, ok := e.Client().Caches.Channel(channelID)
	if !ok || channel.GuildID() != *e.GuildID() {
		return nil, notFound
	}

	if channel.Type() != discord.ChannelTypeGuildVoice {
		return nil, disgox.UserErrorf("<#%s> is not a voice channel.", channelID)
	}

	return channel, nil
}

// add opens the settings modal for a new lobby. The lobby is created when the modal is submitted.
func (c *voiceRoomLobbyCommand) add(data discord.SlashCommandInteractionData, e *handler.CommandEvent) error {
	channel, err := voiceChannelOption(data, e)
	if err != nil {
		return err
	}

	// checked before opening the modal, so the settings aren't filled in for nothing.
	if _, err := c.db.VoiceRooms.GetLobby(e.Ctx, *e.GuildID(), channel.ID()); err == nil {
		return disgox.UserErrorf("This channel is already a voice room lobby.")
	} else if !errors.Is(err, database.ErrVoiceRoomLobbyNotFound) {
		return err
	}

	if _, err := c.db.VoiceRooms.GetRoom(e.Ctx, *e.GuildID(), channel.ID()); err == nil {
		return disgox.UserErrorf("This channel is an active voice room and cannot be a voice room lobby.")
	} else if !errors.Is(err, database.ErrVoiceRoomNotFound) {
		return err
	}

	// the zero value matches the defaults of a new lobby: no user limit and nothing allowed.
	return e.Modal(lobbySettingsModal(fmt.Sprintf(lobbyAddID, channel.ID()), "New Voice Room Lobby", gen.GuildVoiceRoomsSetting{}))
}

func (c *voiceRoomLobbyCommand) addSubmit(e *handler.ModalEvent) error {
	channelID, err := modalChannelID(e)
	if err != nil {
		return err
	}

	settings, err := lobbySettings(e.Data)
	if err != nil {
		return err
	}

	if err := e.DeferCreateMessage(true); err != nil {
		return err
	}

	if _, err := c.db.VoiceRooms.CreateLobby(e.Ctx, *e.GuildID(), channelID, settings); err != nil {
		switch {
		case errors.Is(err, database.ErrVoiceRoomLobbyExists):
			return disgox.WrapUserError(err, "This channel is already a voice room lobby.")
		case errors.Is(err, database.ErrVoiceRoomLobbyIsVoiceRoom):
			return disgox.WrapUserError(err, "This channel is an active voice room and cannot be a voice room lobby.")
		}

		return err
	}

	_, err = e.CreateFollowupMessage(discord.MessageCreate{Content: fmt.Sprintf("<#%s> is now a voice room lobby.", channelID)})
	return err
}

// update opens the settings modal, filled in with the lobby's current settings.
func (c *voiceRoomLobbyCommand) update(data discord.SlashCommandInteractionData, e *handler.CommandEvent) error {
	channel, err := voiceChannelOption(data, e)
	if err != nil {
		return err
	}

	lobby, err := c.db.VoiceRooms.GetLobby(e.Ctx, *e.GuildID(), channel.ID())
	if err != nil {
		if errors.Is(err, database.ErrVoiceRoomLobbyNotFound) {
			return disgox.WrapUserError(err, "This channel is not a voice room lobby.")
		}

		return err
	}

	return e.Modal(lobbySettingsModal(fmt.Sprintf(lobbyUpdateID, channel.ID()), "Update Voice Room Lobby", lobby))
}

func (c *voiceRoomLobbyCommand) updateSubmit(e *handler.ModalEvent) error {
	channelID, err := modalChannelID(e)
	if err != nil {
		return err
	}

	settings, err := lobbySettings(e.Data)
	if err != nil {
		return err
	}

	if err := e.DeferCreateMessage(true); err != nil {
		return err
	}

	if _, err := c.db.VoiceRooms.UpdateLobby(e.Ctx, *e.GuildID(), channelID, settings); err != nil {
		if errors.Is(err, database.ErrVoiceRoomLobbyNotFound) {
			return disgox.WrapUserError(err, "This channel is not a voice room lobby.")
		}

		return err
	}

	_, err = e.CreateFollowupMessage(discord.MessageCreate{Content: fmt.Sprintf("The voice room lobby <#%s> has been updated.", channelID)})
	return err
}

func (c *voiceRoomLobbyCommand) remove(data discord.SlashCommandInteractionData, e *handler.CommandEvent) error {
	// the channel may already be deleted, so only the ID is checked here.
	channelID, err := snowflake.Parse(data.String("channel"))
	if err != nil {
		return disgox.UserErrorf("The channel you specified does not exist.")
	}

	if err := e.DeferCreateMessage(true); err != nil {
		return err
	}

	if err := c.db.VoiceRooms.DeleteLobby(e.Ctx, *e.GuildID(), channelID); err != nil {
		if errors.Is(err, database.ErrVoiceRoomLobbyNotFound) {
			return disgox.WrapUserError(err, "This channel is not a voice room lobby.")
		}

		return err
	}

	_, err = e.CreateFollowupMessage(discord.MessageCreate{Content: "The voice room lobby has been removed."})
	return err
}

// autocompleteChannels suggests voice channels that are not already lobbies or voice rooms.
func (c *voiceRoomLobbyCommand) autocompleteChannels(e *handler.AutocompleteEvent) error {
	guildID := *e.GuildID()

	lobbies, err := c.db.VoiceRooms.GetLobbies(e.Ctx, guildID)
	if err != nil {
		return err
	}

	taken := make(map[snowflake.ID]struct{})
	for _, lobby := range lobbies {
		taken[lobby.VoiceChannelID] = struct{}{}
		for _, roomID := range lobby.OpenedRooms {
			taken[roomID] = struct{}{}
		}
	}

	var channels []discord.GuildChannel
	for channel := range e.Client().Caches.ChannelsForGuild(guildID) {
		if channel.Type() != discord.ChannelTypeGuildVoice {
			continue
		}

		if _, ok := taken[channel.ID()]; ok {
			continue
		}

		channels = append(channels, channel)
	}

	slices.SortFunc(channels, func(a, b discord.GuildChannel) int {
		return cmp.Compare(a.Position(), b.Position())
	})

	query := focusedValue(e)
	choices := make([]discord.AutocompleteChoice, 0, maxAutocompleteChoices)
	for _, channel := range channels {
		if len(choices) == maxAutocompleteChoices {
			break
		}

		name := fmt.Sprintf("🔊 %s (%s)", channel.Name(), channel.ID())
		if !matchesQuery(name, query) {
			continue
		}

		choices = append(choices, discord.AutocompleteChoiceString{Name: choiceName(name), Value: channel.ID().String()})
	}

	return e.AutocompleteResult(choices)
}

// autocompleteLobbies suggests the guild's existing lobbies.
func (c *voiceRoomLobbyCommand) autocompleteLobbies(e *handler.AutocompleteEvent) error {
	guildID := *e.GuildID()

	lobbies, err := c.db.VoiceRooms.GetLobbies(e.Ctx, guildID)
	if err != nil {
		return err
	}

	query := focusedValue(e)
	choices := make([]discord.AutocompleteChoice, 0, maxAutocompleteChoices)
	for _, lobby := range lobbies {
		if len(choices) == maxAutocompleteChoices {
			break
		}

		// deleted channels are still listed so their lobby can be removed.
		name := lobby.VoiceChannelID.String()
		if channel, ok := e.Client().Caches.Channel(lobby.VoiceChannelID); ok {
			name = fmt.Sprintf("🔊 %s (%s)", channel.Name(), lobby.VoiceChannelID)
		}

		if !matchesQuery(name, query) {
			continue
		}

		choices = append(choices, discord.AutocompleteChoiceString{Name: choiceName(name), Value: lobby.VoiceChannelID.String()})
	}

	return e.AutocompleteResult(choices)
}

// focusedValue returns what the user has typed into the channel option so far.
func focusedValue(e *handler.AutocompleteEvent) string {
	return e.Data.String("channel")
}

// choiceName shortens a name to Discord's 100 character limit for autocomplete choices.
func choiceName(name string) string {
	if r := []rune(name); len(r) > 100 {
		return string(r[:99]) + "…"
	}

	return name
}

func matchesQuery(name, query string) bool {
	return query == "" || strings.Contains(strings.ToLower(name), strings.ToLower(query))
}
