package render

import "github.com/tdewolff/canvas"

// Rect is an axis-aligned rectangle in drawing units; (X, Y) is the top-left corner.
type Rect struct {
	X, Y, W, H float64
}

func (r Rect) Right() float64 {
	return r.X + r.W
}

func (r Rect) Bottom() float64 {
	return r.Y + r.H
}

// Offset moves the rect by (dx, dy).
func (r Rect) Offset(dx, dy float64) Rect {
	return Rect{r.X + dx, r.Y + dy, r.W, r.H}
}

// Inset shrinks the rect by d on every side (negative d grows it).
func (r Rect) Inset(d float64) Rect {
	return Rect{r.X + d, r.Y + d, r.W - 2*d, r.H - 2*d}
}

// canvas converts to tdewolff's corner-based rect.
func (r Rect) canvas() canvas.Rect {
	return canvas.Rect{X0: r.X, Y0: r.Y, X1: r.Right(), Y1: r.Bottom()}
}
