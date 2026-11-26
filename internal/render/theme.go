package render

import (
	"bytes"
	"embed"
	"image"
	"image/color"
	"image/draw"
	"math"
	"sync"
)

// Colours and surfaces from the "Typical Developers Bot Designs" Figma file.

//go:embed assets/images/*.png
var imageFiles embed.FS

// bgScale is the resolution backgrounds are composed at, in pixels per drawing unit.
const bgScale = Scale

var white = color.RGBA{255, 255, 255, 255}

var (
	cardBase = hex("#12131e")

	// the card's border fades from top to bottom.
	cardBorder = vgrad(gradientStop{0, hex("#2a2b3b")}, gradientStop{1, hex("#12131e")})

	// the week and month chips' border fades from top to bottom.
	chipBorder = vgrad(gradientStop{0, hex("#363a58")}, gradientStop{1, hex("#232536")})
)

// activityAccent is the gradient used for an activity's icon circle and progress bar.
type activityAccent struct {
	from, to color.RGBA
}

var chatAccent = activityAccent{hex("#5c64ff"), hex("#ff83de")}

func (a activityAccent) paint() paint {
	return hgrad(a.from, a.to)
}

func (a activityAccent) tint(o float64) paint {
	return hgrad(alpha(a.from, o), alpha(a.to, o))
}

// rankPaint colours an all time rank, top to bottom: gold to pink for #1 to #50, white to blue
// from #51. Week and month ranks are plain white.
func rankPaint(rank int) paint {
	switch {
	case rank <= 0:
		return solid(alpha(white, 0.5))
	case rank <= 50:
		return vgrad(gradientStop{0, hex("#ffd678")}, gradientStop{1, hex("#ff498b")})
	default:
		return vgrad(gradientStop{0, white}, gradientStop{1, hex("#3e7cbf")})
	}
}

// rankText formats a rank as "#12", or a dash when there's no rank.
func rankText(rank int) string {
	if rank <= 0 {
		return "—"
	}
	return "#" + commas(rank)
}

// shade returns c's hue at full saturation and the given lightness (0–1). Frame 327 colours a
// role's icon and text this way: #471AA6 gives an #AB83FF icon and #FBF6FF text.
func shade(c color.RGBA, lightness float64) color.RGBA {
	r, g, b := float64(c.R)/255, float64(c.G)/255, float64(c.B)/255
	mx, mn := math.Max(r, math.Max(g, b)), math.Min(r, math.Min(g, b))

	hue := 0.0
	switch d := mx - mn; {
	case d == 0:
		// grey: there's no hue, so keep it grey.
		v := uint8(math.Round(lightness * 255))
		return color.RGBA{v, v, v, 255}
	case mx == r:
		hue = math.Mod((g-b)/d, 6)
	case mx == g:
		hue = (b-r)/d + 2
	default:
		hue = (r-g)/d + 4
	}
	hue *= 60
	if hue < 0 {
		hue += 360
	}

	// HSL to RGB with saturation 1.
	chroma := 1 - math.Abs(2*lightness-1)
	x := chroma * (1 - math.Abs(math.Mod(hue/60, 2)-1))
	var rr, gg, bb float64
	switch {
	case hue < 60:
		rr, gg = chroma, x
	case hue < 120:
		rr, gg = x, chroma
	case hue < 180:
		gg, bb = chroma, x
	case hue < 240:
		gg, bb = x, chroma
	case hue < 300:
		rr, bb = x, chroma
	default:
		rr, bb = chroma, x
	}
	m := lightness - chroma/2
	to := func(v float64) uint8 { return uint8(math.Round(math.Max(0, math.Min(1, v+m)) * 255)) }
	return color.RGBA{to(rr), to(gg), to(bb), 255}
}

var images struct {
	once     sync.Once
	profile  image.Image // card_default's background (fill, texture, shading and border) at 2x
	texture  image.Image // the contour texture at 10% opacity, at 2x
	calendar image.Image // leaderboard icons, white, at 2x
	clock    image.Image
}

func loadImages() {
	images.once.Do(func() {
		load := func(name string) image.Image {
			b, err := imageFiles.ReadFile("assets/images/" + name)
			if err != nil {
				return nil
			}
			img, _, err := image.Decode(bytes.NewReader(b))
			if err != nil {
				return nil
			}
			return img
		}
		images.profile = load("profile-card-background.png")
		images.texture = load("texture.png")
		images.calendar = load("icon-calendar.png")
		images.clock = load("icon-clock.png")
	})
}

// cardBackground composes a card background of any size, like the Figma frames' fills: the base
// colour, the contour texture at 5%, and black shading that is 75% at the bottom, shadeMid at 80%
// of the way up and clear at the top. Corners are rounded to radius.
func cardBackground(w, h, radius, shadeMid float64) *image.RGBA {
	loadImages()

	pw, ph := int(math.Ceil(w*bgScale)), int(math.Ceil(h*bgScale))
	img := image.NewRGBA(image.Rect(0, 0, pw, ph))
	fillVertical(img, []gradientStop{{0, cardBase}, {1, cardBase}})

	// the texture is exported at 10% and tiles from the top-left; half strength gives 5%.
	if tex := images.texture; tex != nil {
		mask := image.NewUniform(color.Alpha{128})
		tb := tex.Bounds()
		for y := 0; y < ph; y += tb.Dy() {
			for x := 0; x < pw; x += tb.Dx() {
				r := image.Rect(x, y, x+tb.Dx(), y+tb.Dy())
				draw.DrawMask(img, r, tex, tb.Min, mask, image.Point{}, draw.Over)
			}
		}
	}

	black := color.RGBA{0, 0, 0, 255}
	fillVertical(img, []gradientStop{
		{0, toRGBA(alpha(black, 0))},
		{0.2, toRGBA(alpha(black, shadeMid))},
		{1, toRGBA(alpha(black, 0.75))},
	})

	return roundCorners(img, radius*bgScale)
}
