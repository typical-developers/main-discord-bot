package render

import (
	"context"
	"image"
	"log/slog"
	"time"

	"github.com/typical-developers/main-discord-bot/internal/cache"
)

// ImageCache downloads the images drawn into a card (avatars, icons) and remembers them for a
// while, since cards are refreshed and paginated a lot. Images are keyed by URL; Discord's CDN URLs
// contain a hash of the image, so a changed avatar is a new URL and is downloaded straight away.
type ImageCache struct {
	images *cache.TTL[string, image.Image]
}

// NewImageCache remembers up to maxImages images for 30 minutes.
func NewImageCache(maxImages int) *ImageCache {
	return &ImageCache{cache.NewTTL[string, image.Image](30*time.Minute, maxImages)}
}

// Fetch returns the image at url, downloading it if it isn't cached. It returns nil when url is
// empty or the download fails; cards draw a placeholder instead, so failures are only logged.
func (c *ImageCache) Fetch(ctx context.Context, url string) image.Image {
	if url == "" {
		return nil
	}

	if img, ok := c.images.Get(url); ok {
		return img
	}

	img, err := FetchImage(ctx, url)
	if err != nil {
		slog.Warn("failed to fetch card image", slog.String("url", url), slog.Any("err", err))
		return nil
	}

	c.images.Set(url, img)
	return img
}
