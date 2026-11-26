package render

import (
	"embed"
	"fmt"
	"image/color"
	"sync"

	"github.com/tdewolff/canvas"
)

// The cards use Fixel (SIL Open Font License, assets/fonts/LICENSE). Go can't pick weights out
// of a variable font, so static instances of FixelVariable.ttf are embedded, one per weight used.
// "Display" is the wide (wdth 100) cut and "Text" the narrow (wdth 75) cut.
//
//go:embed assets/fonts/*.ttf
var fontFiles embed.FS

type fontID string

const (
	displaySemiBold  fontID = "FixelDisplay-SemiBold"
	displayBold      fontID = "FixelDisplay-Bold"
	displayExtraBold fontID = "FixelDisplay-ExtraBold"
	displayBlack     fontID = "FixelDisplay-Black"
	textRegular      fontID = "FixelText-Regular"
	textBold         fontID = "FixelText-Bold"
	textBlack        fontID = "FixelText-Black"
)

var allFonts = []fontID{
	displaySemiBold, displayBold, displayExtraBold, displayBlack,
	textRegular, textBold, textBlack,
}

// Fonts holds the loaded fonts plus a cache of font faces, so each
// font/size/colour is only set up once. Safe for concurrent use.
type Fonts struct {
	families map[fontID]*canvas.FontFamily

	mu    sync.Mutex
	faces map[faceKey]*canvas.FontFace
}

type faceKey struct {
	style textStyle
	color color.RGBA
}

// LoadFonts loads the embedded fonts.
func LoadFonts() (*Fonts, error) {
	f := &Fonts{
		families: make(map[fontID]*canvas.FontFamily, len(allFonts)),
		faces:    map[faceKey]*canvas.FontFace{},
	}

	for _, id := range allFonts {
		b, err := fontFiles.ReadFile("assets/fonts/" + string(id) + ".ttf")
		if err != nil {
			return nil, fmt.Errorf("render: read font %s: %w", id, err)
		}

		fam := canvas.NewFontFamily(string(id))
		if err := fam.LoadFont(b, 0, canvas.FontRegular); err != nil {
			return nil, fmt.Errorf("render: load font %s: %w", id, err)
		}
		f.families[id] = fam
	}

	return f, nil
}

var defaultFonts struct {
	once sync.Once
	f    *Fonts
	err  error
}

// DefaultFonts returns the embedded fonts, loading them on first use.
func DefaultFonts() (*Fonts, error) {
	defaultFonts.once.Do(func() {
		defaultFonts.f, defaultFonts.err = LoadFonts()
	})
	return defaultFonts.f, defaultFonts.err
}
