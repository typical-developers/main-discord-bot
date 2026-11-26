package render

import (
	"fmt"
	"image"
	"math"

	"github.com/tdewolff/canvas"
)

// LeaderboardCard is one page of a server's activity leaderboard, built from the
// "leaderboard_default" frame in Figma.
type LeaderboardCard struct {
	// GuildIcon is the server's icon; a placeholder is drawn when nil.
	GuildIcon image.Image
	GuildName string

	// Period describes the leaderboard's time period, e.g. "This Week (11/23/2026 - 11/29/2026)".
	Period string
	// ResetsIn is the time left until the leaderboard resets, e.g. "07d 12h 10m". The reset pill
	// is left out when it's empty (all time leaderboards).
	ResetsIn string

	// ValueLabel heads the value column, e.g. "Points".
	ValueLabel string

	Rows []LeaderboardRow

	// Page is the page being shown, and TotalEntries how many members are on the whole
	// leaderboard; they make up the footer's "Page 1 • Showing 15 of 1,234".
	Page         int
	TotalEntries int
	// UpdatedAt is when the leaderboard was last updated, e.g. "11/26/2026 20:25 UTC".
	UpdatedAt string
}

type LeaderboardRow struct {
	Rank int
	// Avatar is the member's avatar; a placeholder is drawn when nil.
	Avatar image.Image
	Name   string
	Value  int
}

// leaderboard_default's geometry, in Figma pixels.
const (
	leaderboardWidth   = 793
	leaderboardPadding = 30
	leaderboardRadius  = 30
	leaderboardGap     = 25

	// header
	serverIconSize   = 80
	serverIconRadius = 20
	headerGap        = 17 // between the icon, the server info and the reset pill

	resetPillHeight = 44
	resetPillPadX   = 15
	resetPillGap    = 10

	// table
	tableHeaderHeight = 27
	tableGap          = 10 // between the column headings and the first row
	rowHeight         = 48
	rowGap            = 5
	rowPadX           = 15
	rowPadY           = 12
	rowAvatar         = 24

	// footer
	footerHeight = 17
	footerPadX   = 10
	footerGap    = 10 // between the page, the dot and the row count
	footerDot    = 4
)

var (
	serverNameStyle = textStyle{displayExtraBold, 24}
	periodStyle     = textStyle{displaySemiBold, 18}
	resetStyle      = textStyle{displaySemiBold, 18}
	columnStyle     = textStyle{displaySemiBold, 20}
	rowRankStyle    = textStyle{displayBlack, 20}
	rowStyle        = textStyle{displaySemiBold, 20}
	footerStyle     = textStyle{displaySemiBold, 14}

	rowHighlight = hex("#17181e")
	resetFill    = hex("#0e0f18")
	resetBorder  = hex("#2a2b3b")
)

// margin gives the leaderboard an extra unit of padding on the left and right.
func (l LeaderboardCard) margin() (x, y float64) {
	return Margin + 1, Margin
}

func (l LeaderboardCard) Layout(f *Fonts) (float64, float64, func(ctx *canvas.Context)) {
	n := float64(len(l.Rows))
	tableH := tableHeaderHeight + tableGap + n*rowHeight + math.Max(0, n-1)*rowGap
	h := leaderboardPadding + serverIconSize + leaderboardGap + tableH + leaderboardGap + footerHeight + leaderboardPadding
	w := float64(leaderboardWidth)

	return w, h, func(ctx *canvas.Context) {
		card := Rect{0, 0, w, h}
		drawImage(ctx, cardBackground(w, h, leaderboardRadius, 0.5), card)
		strokeRoundRect(ctx, card, leaderboardRadius, 1, cardBorder)

		inner := card.Inset(leaderboardPadding)
		l.drawHeader(ctx, f, Rect{inner.X, inner.Y, inner.W, serverIconSize})
		tableY := inner.Y + serverIconSize + leaderboardGap
		l.drawTable(ctx, f, Rect{inner.X, tableY, inner.W, tableH})
		l.drawFooter(ctx, f, Rect{inner.X, tableY + tableH + leaderboardGap, inner.W, footerHeight})
	}
}

// drawFooter draws "Page 1 • Showing 15 of 1,234" on the left and when it was last updated on the right.
func (l LeaderboardCard) drawFooter(ctx *canvas.Context, f *Fonts, r Rect) {
	col := alpha(white, 0.5)
	base := f.baseline(r.Y, r.H, footerStyle)

	x := r.X + footerPadX
	page := fmt.Sprintf("Page %s", commas(l.Page))
	f.text(ctx, page, x, base, footerStyle, col, alignLeft)
	x += f.width(page, footerStyle) + footerGap

	fillRoundRect(ctx, Rect{x, r.Y + (r.H-footerDot)/2, footerDot, footerDot}, footerDot/2, solid(alpha(white, 0.25)))
	x += footerDot + footerGap

	showing := fmt.Sprintf("Showing %s of %s", commas(len(l.Rows)), commas(l.TotalEntries))
	f.text(ctx, showing, x, base, footerStyle, col, alignLeft)

	if l.UpdatedAt != "" {
		f.text(ctx, "Last Updated: "+l.UpdatedAt, r.Right()-footerPadX, base, footerStyle, col, alignRight)
	}
}

// drawHeader draws the server icon, name and period on the left and the reset pill on the right.
func (l LeaderboardCard) drawHeader(ctx *canvas.Context, f *Fonts, r Rect) {
	loadImages()

	icon := Rect{r.X, r.Y, serverIconSize, serverIconSize}
	if l.GuildIcon != nil {
		drawImage(ctx, roundCorners(coverSquare(l.GuildIcon, serverIconSize*Scale), serverIconRadius*Scale), icon)
	} else {
		fillRoundRect(ctx, icon, serverIconRadius, solid(hex("#5865f2")))
	}

	infoX := icon.Right() + headerGap
	infoRight := r.Right()

	if l.ResetsIn != "" {
		tw := f.width(l.ResetsIn, resetStyle)
		pill := Rect{0, r.Y + (r.H-resetPillHeight)/2, resetPillPadX + 20 + resetPillGap + tw + resetPillPadX, resetPillHeight}
		pill.X = r.Right() - pill.W
		infoRight = pill.X - headerGap

		fillRoundRect(ctx, pill, pill.H/2, solid(resetFill))
		strokeRoundRect(ctx, pill, pill.H/2, 1, solid(resetBorder))
		if images.clock != nil {
			drawImage(ctx, images.clock, Rect{pill.X + resetPillPadX, pill.Y + 12, 20, 20})
		}
		f.text(ctx, l.ResetsIn, pill.Right()-resetPillPadX, f.baseline(pill.Y+11, 22, resetStyle), resetStyle, white, alignRight)
	}

	// the server name, then the period with a calendar icon, centred on the icon.
	const (
		nameH   = 29
		gap     = 5
		periodH = 22
	)
	maxW := infoRight - infoX
	top := r.Y + (r.H-(nameH+gap+periodH))/2

	name := f.truncate(l.GuildName, serverNameStyle, maxW)
	f.text(ctx, name, infoX, f.baseline(top, nameH, serverNameStyle), serverNameStyle, white, alignLeft)

	periodTop := top + nameH + gap
	if images.calendar != nil {
		drawImage(ctx, images.calendar, Rect{infoX, periodTop + 1, 20, 20})
	}
	period := f.truncate(l.Period, periodStyle, maxW-25)
	f.text(ctx, period, infoX+25, f.baseline(periodTop, periodH, periodStyle), periodStyle, alpha(white, 0.5), alignLeft)
}

// drawTable draws the column headings and the rows, highlighting every other row from the first.
func (l LeaderboardCard) drawTable(ctx *canvas.Context, f *Fonts, r Rect) {
	// columns, from the left edge of the table. The "Member" heading lines up with the avatars.
	const (
		memberX    = 135
		valueRight = 718
		nameMaxW   = 257.5
	)

	headingBase := f.baseline(r.Y-1, 24, columnStyle)
	f.text(ctx, "#", r.X+rowPadX, headingBase, columnStyle, white, alignLeft)
	f.text(ctx, "Member", r.X+memberX, headingBase, columnStyle, white, alignLeft)
	f.text(ctx, l.ValueLabel, r.X+valueRight, headingBase, columnStyle, white, alignRight)

	y := r.Y + tableHeaderHeight + tableGap
	for i, row := range l.Rows {
		box := Rect{r.X, y, r.W, rowHeight}
		if i%2 == 0 {
			fillRoundRect(ctx, box, rowHeight/2, solid(rowHighlight))
		}

		textTop := y + rowPadY
		f.text(ctx, rankText(row.Rank), r.X+rowPadX, f.baseline(textTop, 24, rowRankStyle), rowRankStyle, white, alignLeft)

		avatar := Rect{r.X + memberX, textTop, rowAvatar, rowAvatar}
		if row.Avatar != nil {
			drawImage(ctx, roundCorners(coverSquare(row.Avatar, rowAvatar*Scale), rowAvatar/2*Scale), avatar)
		} else {
			fillRoundRect(ctx, avatar, rowAvatar/2, solid(hex("#5865f2")))
		}

		base := f.baseline(textTop, 24, rowStyle)
		f.text(ctx, f.truncate(row.Name, rowStyle, nameMaxW), avatar.Right()+5, base, rowStyle, white, alignLeft)
		f.text(ctx, commas(row.Value), r.X+valueRight, base, rowStyle, white, alignRight)

		y += rowHeight + rowGap
	}
}
