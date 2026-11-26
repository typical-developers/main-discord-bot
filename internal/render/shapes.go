package render

import (
	"image"
	"math"

	"github.com/tdewolff/canvas"
)

// roundRect returns a rounded rectangle path at r's absolute position.
func roundRect(r Rect, radius float64) *canvas.Path {
	radius = math.Max(0, math.Min(radius, math.Min(r.W, r.H)/2))
	return canvas.RoundedRectangle(r.W, r.H, radius).Translate(r.X, r.Y)
}

// fillRoundRect fills a rounded rectangle with p.
func fillRoundRect(ctx *canvas.Context, r Rect, radius float64, p paint) {
	if r.W <= 0 || r.H <= 0 {
		return
	}
	setFill(ctx, p, r)
	ctx.SetStrokeColor(transparent)
	ctx.DrawPath(0, 0, roundRect(r, radius))
}

// strokeRoundRect draws a border of the given width inside a rounded rectangle, like Figma's
// "inside" stroke alignment. The border is filled as a ring (the outer shape minus the inner one)
// so it can take a gradient like any other fill.
func strokeRoundRect(ctx *canvas.Context, r Rect, radius, width float64, p paint) {
	inner := r.Inset(width)
	if r.W <= 0 || r.H <= 0 {
		return
	}

	ring := roundRect(r, radius)
	if inner.W > 0 && inner.H > 0 {
		ring = ring.Append(roundRect(inner, radius-width).Reverse())
	}

	setFill(ctx, p, r)
	ctx.SetStrokeColor(transparent)
	ctx.DrawPath(0, 0, ring)
}

// drawIcon fills an icon path (in a viewBox×viewBox coordinate space) scaled into r.
func drawIcon(ctx *canvas.Context, icon *canvas.Path, viewBox float64, r Rect, p paint) {
	path := icon.Copy().Scale(r.W/viewBox, r.H/viewBox).Translate(r.X, r.Y)
	setFill(ctx, p, r)
	ctx.SetStrokeColor(transparent)
	ctx.DrawPath(0, 0, path)
}

// drawImage draws img scaled into r (images are pre-sized to r's aspect ratio). Callers crop and round images beforehand
// (see coverSquare and roundCorners), because tdewolff has no clipping.
func drawImage(ctx *canvas.Context, img image.Image, r Rect) {
	if img == nil || img.Bounds().Empty() {
		return
	}
	ctx.FitImage(img, r.canvas(), canvas.ImageContain)
}
