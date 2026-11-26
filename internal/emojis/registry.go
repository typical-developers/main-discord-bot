package emojis

import (
	"fmt"
	"slices"
	"strings"
	"sync"

	"github.com/disgoorg/disgo/discord"
	"github.com/disgoorg/disgo/rest"
	"github.com/disgoorg/snowflake/v2"
)

// Emoji is the name of an application emoji.
type Emoji string

var (
	EmojiPreviousArrow Emoji = "previous_arrow"
	EmojiNextArrow     Emoji = "next_arrow"
	EmojiRefresh       Emoji = "refresh"

	EmojiRename    Emoji = "rename"
	EmojiLock      Emoji = "lock"
	EmojiUnlock    Emoji = "unlock"
	EmojiUserLimit Emoji = "user_limit"
	EmojiReclaim   Emoji = "reclaim"
	EmojiClose     Emoji = "close"
)

// required are the emojis the bot uses. Load fails if any of them aren't uploaded.
var required = []Emoji{
	EmojiPreviousArrow, EmojiNextArrow, EmojiRefresh,
	EmojiRename, EmojiLock, EmojiUnlock, EmojiUserLimit, EmojiReclaim, EmojiClose,
}

var (
	mu       sync.RWMutex
	registry = map[Emoji]discord.Emoji{}
)

// Load will load all the the application emojis. It returns an error naming any required emoji
// that hasn't been uploaded, so a missing emoji is caught at startup instead of on a button.
func Load(rest rest.Rest, applicationId snowflake.ID) error {
	applicationEmojis, err := rest.GetApplicationEmojis(applicationId)
	if err != nil {
		return err
	}

	loaded := make(map[Emoji]discord.Emoji, len(applicationEmojis))
	for _, emoji := range applicationEmojis {
		loaded[Emoji(emoji.Name)] = emoji
	}

	var missing []string
	for _, name := range required {
		if _, ok := loaded[name]; !ok {
			missing = append(missing, string(name))
		}
	}
	if len(missing) > 0 {
		slices.Sort(missing)
		return fmt.Errorf("application emojis not uploaded: %s", strings.Join(missing, ", "))
	}

	mu.Lock()
	registry = loaded
	mu.Unlock()

	return nil
}

// Get will get an emoji by its name.
func Get(name Emoji) (discord.Emoji, bool) {
	mu.RLock()
	defer mu.RUnlock()

	e, ok := registry[name]
	return e, ok
}

// MustGet means the emoji MUST return, otherwise it will panic.
func MustGet(name Emoji) discord.Emoji {
	e, ok := Get(name)
	if !ok {
		panic(fmt.Sprintf("application emoji %q is not registered", name))
	}

	return e
}

// Component returns an emoji for a button or select menu option.
func Component(name Emoji) discord.ComponentEmoji {
	e := MustGet(name)
	return discord.ComponentEmoji{ID: e.ID, Name: e.Name, Animated: e.Animated}
}
