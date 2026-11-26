// Package render draws the bot's image cards (profile and leaderboard).
//
// The drawing utilities are adapted from oakley-bot's render package. One drawing unit is one
// pixel of the Figma design; PNG output is rasterized at a scale (2 for hi-DPI).
package render

import (
	"bytes"
	"image"
	"image/draw"
	"image/png"
	"math"
	"sync"

	"github.com/tdewolff/canvas"
	"github.com/tdewolff/canvas/renderers/rasterizer"
)

// Scale is the default output scale: pixels per drawing unit.
const Scale = 2

// Margin is the transparent padding around every rendered card, in drawing units.
const Margin = 1

// Drawable is anything that can lay itself out and draw. Layout works out
// the size once and returns a draw function that reuses that layout, so
// nothing is measured twice.
type Drawable interface {
	Layout(f *Fonts) (w, h float64, draw func(ctx *canvas.Context))
}

// newContext returns a drawing context with the origin top-left and y down.
func newContext(c *canvas.Canvas) *canvas.Context {
	ctx := canvas.NewContext(c)
	ctx.SetCoordSystem(canvas.CartesianIV)
	return ctx
}

// Build draws d onto a new canvas sized to fit it exactly.
func Build(d Drawable, f *Fonts) *canvas.Canvas {
	w, h, draw := d.Layout(f)
	c := canvas.New(w, h)
	draw(newContext(c))
	return c
}

// Rasterize renders d to an image. scale is pixels per drawing unit.
func Rasterize(d Drawable, f *Fonts, scale float64) *image.RGBA {
	if scale <= 0 {
		scale = 1
	}
	// One unit is one millimetre to tdewolff, so DPMM(scale) gives
	// `scale` pixels per unit.
	img := rasterizer.Draw(Build(d, f), canvas.DPMM(scale), canvas.DefaultColorSpace)

	// a transparent margin around the card, so its border and corners aren't cut off at the
	// image's edge.
	mx, my := float64(Margin), float64(Margin)
	if c, ok := d.(customMargin); ok {
		mx, my = c.margin()
	}
	px, py := int(math.Round(mx*scale)), int(math.Round(my*scale))

	b := img.Bounds()
	out := image.NewRGBA(image.Rect(0, 0, b.Dx()+2*px, b.Dy()+2*py))
	draw.Draw(out, b.Add(image.Pt(px, py)), img, b.Min, draw.Src)
	return out
}

// customMargin is implemented by cards that need a different margin than Margin: x on the left
// and right, y on the top and bottom, in drawing units.
type customMargin interface {
	margin() (x, y float64)
}

// PNG renders d to PNG bytes in memory, e.g. for a Discord attachment.
func PNG(d Drawable, f *Fonts, scale float64) ([]byte, error) {
	var buf bytes.Buffer
	if err := pngEncoder.Encode(&buf, Rasterize(d, f, scale)); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// pngEncoder favours speed: the files are a little larger, but encoding is
// much faster than the default compression. Buffers are reused between calls.
var pngEncoder = png.Encoder{
	CompressionLevel: png.BestSpeed,
	BufferPool:       &pngBuffers{},
}

type pngBuffers struct{ pool sync.Pool }

func (p *pngBuffers) Get() *png.EncoderBuffer {
	b, _ := p.pool.Get().(*png.EncoderBuffer)
	return b
}

func (p *pngBuffers) Put(b *png.EncoderBuffer) { p.pool.Put(b) }
