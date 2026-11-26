package render

import (
	"image/color"
	"math"
	"strconv"

	"github.com/tdewolff/canvas"
)

// textStyle is a font and a size in drawing units (Figma pixels).
type textStyle struct {
	Font fontID
	Size float64
}

// One drawing unit is one pixel, but tdewolff takes font sizes in points and treats units as
// millimetres: px → pt is ×72/25.4.
const ptPerUnit = 72 / 25.4

func (f *Fonts) face(s textStyle, col color.Color) *canvas.FontFace {
	key := faceKey{s, toRGBA(col)}

	f.mu.Lock()
	defer f.mu.Unlock()

	if face, ok := f.faces[key]; ok {
		return face
	}

	face := f.families[s.Font].Face(s.Size*ptPerUnit, key.color, canvas.FontRegular)
	f.faces[key] = face
	return face
}

// width returns the advance width of str.
func (f *Fonts) width(str string, s textStyle) float64 {
	return f.face(s, color.Black).TextWidth(str)
}

// baseline returns the baseline y for a line of text in a Figma text layer whose box starts at
// top and is boxH tall.
//
// Figma centres the font's Windows ascent and descent (750 and 250 units for Fixel) in the box
// and rounds the baseline down the page to a whole pixel. Measured against Frame 327's text
// layers, this lands on the same pixel at every size used.
func (f *Fonts) baseline(top, boxH float64, s textStyle) float64 {
	const winAscent, winDescent = 0.75, 0.25
	return top + math.Ceil(boxH/2+(winAscent-winDescent)/2*s.Size-1e-9)
}

type align int

const (
	alignLeft align = iota
	alignCenter
	alignRight
)

// anchor moves x so text of width w is aligned at x.
func anchor(x, w float64, a align) float64 {
	switch a {
	case alignCenter:
		return x - w/2
	case alignRight:
		return x - w
	}
	return x
}

// text draws str in a solid colour with its baseline at y, anchored at x.
func (f *Fonts) text(ctx *canvas.Context, str string, x, y float64, s textStyle, col color.Color, a align) {
	x = anchor(x, f.width(str, s), a)
	ctx.DrawText(x, y, canvas.NewTextLine(f.face(s, col), str, canvas.Left))
}

// paintText draws str filled with p (a solid colour or a gradient across the text's width).
func (f *Fonts) paintText(ctx *canvas.Context, str string, x, y float64, s textStyle, p paint, a align) {
	if !p.isGradient() {
		f.text(ctx, str, x, y, s, p.solid, a)
		return
	}

	w := f.width(str, s)
	x = anchor(x, w, a)

	path, _ := f.face(s, color.White).ToPath(str)
	if path == nil {
		return
	}

	// Paths here are y-down. Glyph outlines need their ascenders above the baseline (negative y),
	// so flip the outline if it came back the other way up.
	if b := path.Bounds(); b.Y1 > -b.Y0 {
		path = path.Scale(1, -1)
	}
	path = path.Translate(x, y)

	m := f.face(s, color.Black).Metrics()
	setFill(ctx, p, Rect{X: x, Y: y - m.Ascent, W: w, H: m.Ascent + m.Descent})
	ctx.SetStrokeColor(transparent)
	ctx.DrawPath(0, 0, path)
}

// blurredShadow draws a soft black shadow of str, like a Figma drop shadow: opacity is the
// shadow's strength and spread is roughly its blur radius divided by two. It's approximated by
// drawing the text faintly at a ring of offsets, since tdewolff has no blur.
func (f *Fonts) blurredShadow(ctx *canvas.Context, str string, x, y float64, s textStyle, opacity, spread float64, a align) {
	const rings, steps = 2, 8

	// each layer's alpha, so that all of them stacked reach the requested opacity.
	layers := 1 + rings*steps
	each := 1 - math.Pow(1-opacity, 1/float64(layers))
	col := alpha(color.Black, each)

	f.text(ctx, str, x, y, s, col, a)
	for ring := 1; ring <= rings; ring++ {
		r := spread * float64(ring) / rings
		for i := range steps {
			angle := 2 * math.Pi * float64(i) / steps
			f.text(ctx, str, x+r*math.Cos(angle), y+r*math.Sin(angle), s, col, a)
		}
	}
}

// truncate shortens str with an ellipsis so it fits within maxW.
func (f *Fonts) truncate(str string, s textStyle, maxW float64) string {
	if f.width(str, s) <= maxW {
		return str
	}

	r := []rune(str)
	lo, hi := 0, len(r)-1
	for lo < hi {
		mid := (lo + hi + 1) / 2
		if f.width(string(r[:mid])+"…", s) <= maxW {
			lo = mid
		} else {
			hi = mid - 1
		}
	}
	return string(r[:lo]) + "…"
}

// commas formats 86000 as "86,000".
func commas(n int) string {
	s := strconv.Itoa(n)
	neg := n < 0
	if neg {
		s = s[1:]
	}
	out := make([]byte, 0, len(s)+len(s)/3)
	for i := range len(s) {
		if i > 0 && (len(s)-i)%3 == 0 {
			out = append(out, ',')
		}
		out = append(out, s[i])
	}
	if neg {
		return "-" + string(out)
	}
	return string(out)
}
