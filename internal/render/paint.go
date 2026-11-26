package render

import (
	"image/color"

	"github.com/tdewolff/canvas"
)

var transparent = color.RGBA{}

// paint is a solid colour or a linear gradient. Gradients run across the rect they're applied
// to: left to right by default, top to bottom when vertical.
type paint struct {
	solid    color.RGBA
	stops    []gradientStop
	vertical bool
}

type gradientStop struct {
	t float64
	c color.RGBA
}

func solid(c color.Color) paint {
	return paint{solid: toRGBA(c)}
}

// hgrad is a left-to-right gradient with evenly spaced colours.
func hgrad(cs ...color.Color) paint {
	p := paint{}
	for i, c := range cs {
		t := 0.0
		if len(cs) > 1 {
			t = float64(i) / float64(len(cs)-1)
		}
		p.stops = append(p.stops, gradientStop{t, toRGBA(c)})
	}
	return p
}

// vgrad is a top-to-bottom gradient with explicit stops.
func vgrad(stops ...gradientStop) paint {
	return paint{stops: stops, vertical: true}
}

func (p paint) isGradient() bool {
	return len(p.stops) > 1
}

// endpoints returns where the gradient starts and ends for rect r.
func (p paint) endpoints(r Rect) (canvas.Point, canvas.Point) {
	if p.vertical {
		return canvas.Point{X: r.X, Y: r.Y}, canvas.Point{X: r.X, Y: r.Bottom()}
	}
	return canvas.Point{X: r.X, Y: r.Y}, canvas.Point{X: r.Right(), Y: r.Y}
}

// setFill makes p the fill for the next path. Paths are drawn at (0,0) with absolute
// coordinates, because tdewolff samples gradients in the coordinates of the path it fills.
func setFill(ctx *canvas.Context, p paint, r Rect) {
	if p.isGradient() {
		g := canvas.NewGradient()
		for _, s := range p.stops {
			g.Add(s.t, s.c)
		}
		a, b := p.endpoints(r)
		ctx.SetFillGradient(g.ToLinear(a, b))
		return
	}
	ctx.SetFillColor(p.solid)
}

func toRGBA(c color.Color) color.RGBA { return color.RGBAModel.Convert(c).(color.RGBA) }

// alpha returns c with its opacity multiplied by a (0–1).
func alpha(c color.Color, a float64) color.NRGBA {
	n := color.NRGBAModel.Convert(c).(color.NRGBA)
	n.A = uint8(float64(n.A)*a + 0.5)
	return n
}

// hex parses "#rrggbb"; for constant theme colours only (panics if malformed).
func hex(s string) color.RGBA {
	if len(s) != 7 || s[0] != '#' {
		panic("render: bad colour " + s)
	}
	v := func(i int) uint8 {
		n := 0
		for _, ch := range s[i : i+2] {
			n <<= 4
			switch {
			case ch >= '0' && ch <= '9':
				n |= int(ch - '0')
			case ch >= 'a' && ch <= 'f':
				n |= int(ch-'a') + 10
			case ch >= 'A' && ch <= 'F':
				n |= int(ch-'A') + 10
			default:
				panic("render: bad colour " + s)
			}
		}
		return uint8(n)
	}
	return color.RGBA{v(1), v(3), v(5), 255}
}
