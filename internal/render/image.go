package render

import (
	"context"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"io"
	"math"
	"net/http"
	"time"

	xdraw "golang.org/x/image/draw"

	// Register decoders for image.Decode.
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
)

const maxImageBytes = 10 << 20 // 10 MB

var httpClient = &http.Client{Timeout: time.Second * 15}

// FetchImage downloads and decodes an image (PNG, JPEG or GIF).
func FetchImage(ctx context.Context, url string) (image.Image, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fetch %s: %s", url, resp.Status)
	}

	img, _, err := image.Decode(io.LimitReader(resp.Body, maxImageBytes))
	if err != nil {
		return nil, err
	}

	return img, nil
}

// coverSquare crops img to a centred square and scales it to size×size pixels.
func coverSquare(img image.Image, size int) *image.RGBA {
	return cover(img, size, size)
}

// cover scales img to fill w×h pixels, cropping the overflow evenly (CSS background-size: cover).
func cover(img image.Image, w, h int) *image.RGBA {
	dst := image.NewRGBA(image.Rect(0, 0, w, h))
	b := img.Bounds()
	if b.Empty() || w <= 0 || h <= 0 {
		return dst
	}

	s := math.Max(float64(w)/float64(b.Dx()), float64(h)/float64(b.Dy()))
	srcW, srcH := float64(w)/s, float64(h)/s
	x0 := float64(b.Min.X) + (float64(b.Dx())-srcW)/2
	y0 := float64(b.Min.Y) + (float64(b.Dy())-srcH)/2
	src := image.Rect(int(x0), int(y0), int(x0+srcW+0.5), int(y0+srcH+0.5)).Intersect(b)

	xdraw.CatmullRom.Scale(dst, dst.Bounds(), img, src, xdraw.Src, nil)
	return dst
}

// roundCorners makes the corners of img transparent outside a radius of r pixels, anti-aliased.
// It's used instead of clipping, which tdewolff doesn't support.
func roundCorners(img *image.RGBA, r float64) *image.RGBA {
	b := img.Bounds()
	w, h := float64(b.Dx()), float64(b.Dy())
	r = math.Min(r, math.Min(w, h)/2)

	for y := 0; y < b.Dy(); y++ {
		for x := 0; x < b.Dx(); x++ {
			px, py := float64(x)+0.5, float64(y)+0.5

			// distance from the nearest corner's circle centre, only inside the corner squares.
			cx, cy := px, py
			switch {
			case px < r:
				cx = r
			case px > w-r:
				cx = w - r
			}
			switch {
			case py < r:
				cy = r
			case py > h-r:
				cy = h - r
			}
			if cx == px || cy == py {
				continue
			}

			coverage := math.Max(0, math.Min(1, r-math.Hypot(px-cx, py-cy)+0.5))
			if coverage >= 1 {
				continue
			}

			// RGBA is premultiplied, so every channel scales with the coverage.
			i := img.PixOffset(b.Min.X+x, b.Min.Y+y)
			for c := range 4 {
				img.Pix[i+c] = uint8(float64(img.Pix[i+c])*coverage + 0.5)
			}
		}
	}

	return img
}

// fillVertical paints dst with a top-to-bottom gradient over what's already there.
func fillVertical(dst *image.RGBA, stops []gradientStop) {
	b := dst.Bounds()
	h := float64(b.Dy())
	for y := 0; y < b.Dy(); y++ {
		c := sampleStops(stops, (float64(y)+0.5)/h)
		line := image.Rect(b.Min.X, b.Min.Y+y, b.Max.X, b.Min.Y+y+1)
		draw.Draw(dst, line, image.NewUniform(c), image.Point{}, draw.Over)
	}
}

// sampleStops returns the gradient's colour at t (0–1), interpolating premultiplied values.
func sampleStops(stops []gradientStop, t float64) color.RGBA {
	if len(stops) == 0 {
		return transparent
	}
	if t <= stops[0].t {
		return stops[0].c
	}
	for i := 1; i < len(stops); i++ {
		if t <= stops[i].t {
			a, b := stops[i-1], stops[i]
			k := (t - a.t) / (b.t - a.t)
			lerp := func(x, y uint8) uint8 { return uint8(float64(x)*(1-k) + float64(y)*k + 0.5) }
			return color.RGBA{lerp(a.c.R, b.c.R), lerp(a.c.G, b.c.G), lerp(a.c.B, b.c.B), lerp(a.c.A, b.c.A)}
		}
	}
	return stops[len(stops)-1].c
}
