package render

import (
	"image"
	"image/color"
	"math"

	"github.com/tdewolff/canvas"
)

// ProfileCard is a member's activity profile card, built from Figma "Frame 327".
//
// The frame has a chat and a voice activity panel and role. Voice activity isn't tracked yet,
// so only the chat ones are drawn, and the chat panel stretches across the card's full width.
type ProfileCard struct {
	// Avatar is the member's avatar; a placeholder is drawn when nil.
	Avatar image.Image

	DisplayName string
	Username    string

	// ChatRole is the member's current chat activity role, or nil when they don't have one yet.
	ChatRole *ProfileRole
	Chat     ActivityStats
	// ChatTheme is the colours the chat panel is themed on: the current chat activity role's
	// gradient, or its solid colour. No colours (or black, Discord's "no colour") uses the
	// default chat theme.
	ChatTheme []color.Color
}

// ProfileRole is an activity role, shown as a pill under the member's name.
type ProfileRole struct {
	Name string
	// Colors is the role's colour, or its gradient's colours from left to right. No colours
	// (or black, Discord's "no colour") is drawn grey.
	Colors []color.Color
	// Icon is the role's icon; the activity's own icon is drawn when nil.
	Icon image.Image
}

// ActivityStats is one activity panel.
type ActivityStats struct {
	Points int

	// Ranks are 0 when the member isn't on that leaderboard.
	AllTimeRank int
	DailyRank   int
	WeeklyRank  int
	MonthlyRank int

	// Progress towards the next activity role, or nil when there isn't one (shown as MAX).
	Progress *Progress
}

// Progress is how far a member is towards their next activity role.
type Progress struct {
	Current  int
	Required int
}

// Frame 327's geometry, in Figma pixels.
const (
	profileWidth  = 893
	profileHeight = 351

	headerTop      = 30
	profileHeaderH = 103.67

	avatarX      = 30
	avatarSize   = 100
	avatarRadius = 25

	infoX = 147 // avatar + 17

	panelX      = 30
	panelTop    = 158.67
	panelWidth  = profileWidth - 2*panelX // 404 in the frame, beside the voice panel
	panelHeight = 162.33
	panelRadius = 15
	panelPad    = 20
)

var (
	nameStyle     = textStyle{displayExtraBold, 24}
	usernameStyle = textStyle{displaySemiBold, 16}
	roleStyle     = textStyle{displayBold, 18}

	titleStyle     = textStyle{displayBlack, 18}
	pointsStyle    = textStyle{textRegular, 16}
	rankStyle      = textStyle{displayBlack, 28}
	allTimeStyle   = textStyle{textBold, 14}
	chipLabelStyle = textStyle{textBold, 14}
	chipValueStyle = textStyle{displayBlack, 16}
	progressStyle  = textStyle{textBlack, 14}
)

func (p ProfileCard) Layout(f *Fonts) (float64, float64, func(ctx *canvas.Context)) {
	return profileWidth, profileHeight, func(ctx *canvas.Context) {
		loadImages()

		card := Rect{0, 0, profileWidth, profileHeight}
		if images.profile != nil {
			drawImage(ctx, images.profile, card)
		} else {
			drawImage(ctx, cardBackground(profileWidth, profileHeight, 30, 0.25), card)
			strokeRoundRect(ctx, card, 30, 1, cardBorder)
		}

		p.drawHeader(ctx, f)
		drawActivityPanel(ctx, f, Rect{panelX, panelTop, panelWidth, panelHeight}, activityPanel{
			title:  "Chat Activity",
			icon:   chatIcon,
			accent: roleAccent(p.ChatTheme, chatAccent),
			stats:  p.Chat,
		})
	}
}

// drawHeader draws the avatar, then the name, username and roles beside it, centred on it.
func (p ProfileCard) drawHeader(ctx *canvas.Context, f *Fonts) {
	const (
		nameH = 29
		userH = 19
		gap   = 10
		pillH = 34
	)

	centre := headerTop + profileHeaderH/2

	avatar := Rect{avatarX, centre - avatarSize/2, avatarSize, avatarSize}
	if p.Avatar != nil {
		px := int(avatarSize * Scale)
		drawImage(ctx, roundCorners(coverSquare(p.Avatar, px), avatarRadius*Scale), avatar)
	} else {
		fillRoundRect(ctx, avatar, avatarRadius, solid(hex("#5865f2")))
	}

	blockH := float64(nameH + userH)
	if p.ChatRole != nil {
		blockH += gap + pillH
	}
	top := centre - blockH/2
	maxW := float64(profileWidth - avatarX - infoX)

	name := f.truncate(p.DisplayName, nameStyle, maxW)
	f.text(ctx, name, infoX, f.baseline(top, nameH, nameStyle), nameStyle, white, alignLeft)

	user := f.truncate("@"+p.Username, usernameStyle, maxW)
	f.text(ctx, user, infoX, f.baseline(top+nameH, userH, usernameStyle), usernameStyle, alpha(white, 0.5), alignLeft)

	if p.ChatRole != nil {
		drawRolePill(ctx, f, Rect{infoX, top + nameH + userH + gap, maxW, pillH}, *p.ChatRole, chatIcon)
	}
}

// drawRolePill draws a role in its colour (or its gradient) with its icon, or the activity's icon
// when it has none.
func drawRolePill(ctx *canvas.Context, f *Fonts, r Rect, role ProfileRole, fallback *canvas.Path) {
	const (
		padX     = 12
		iconSize = 18
		gap      = 7
	)

	stops := roleStops(role.Colors)
	if len(stops) == 0 {
		stops = []color.RGBA{hex("#99aab5")} // Discord's colour for roles without one
	}
	col := stops[0]

	// the icon follows the gradient too, in the same lighter shades as a solid role.
	iconStops := make([]color.RGBA, len(stops))
	for i, c := range stops {
		iconStops[i] = shade(c, 0.76)
	}

	name := f.truncate(role.Name, roleStyle, r.W-2*padX-iconSize-gap)
	pill := Rect{r.X, r.Y, padX + iconSize + gap + f.width(name, roleStyle) + padX, r.H}

	fillRoundRect(ctx, pill, r.H/2, gradientOf(stops, 0.25))
	strokeRoundRect(ctx, pill, r.H/2, 1, gradientOf(stops, 1))

	icon := Rect{pill.X + padX, pill.Y + (pill.H-iconSize)/2, iconSize, iconSize}
	if role.Icon != nil {
		drawImage(ctx, coverSquare(role.Icon, iconSize*Scale), icon)
	} else {
		drawIcon(ctx, fallback, iconViewBox, icon, gradientOf(iconStops, 1))
	}

	f.text(ctx, name, icon.Right()+gap, f.baseline(pill.Y, pill.H, roleStyle), roleStyle, shade(col, 0.98), alignLeft)
}

type activityPanel struct {
	title  string
	icon   *canvas.Path
	accent activityAccent
	stats  ActivityStats
}

func drawActivityPanel(ctx *canvas.Context, f *Fonts, r Rect, p activityPanel) {
	// black, with the activity's accent over it at 10% and a 25% accent border.
	fillRoundRect(ctx, r, panelRadius, solid(color.Black))
	fillRoundRect(ctx, r, panelRadius, p.accent.tint(0.10))
	strokeRoundRect(ctx, r, panelRadius, 1, p.accent.tint(0.25))

	in := r.Inset(panelPad)
	s := p.stats

	// row 1: icon, title and points on the left; all time rank on the right.
	circle := Rect{in.X, in.Y + 0.5, 50, 50}
	fillRoundRect(ctx, circle, 25, solid(color.Black))
	fillRoundRect(ctx, circle, 25, p.accent.tint(0.20))
	strokeRoundRect(ctx, circle, 25, 1, p.accent.tint(0.25))
	drawIcon(ctx, p.icon, iconViewBox, Rect{circle.X + 12.5, circle.Y + 12.83, 25, 25}, solid(white))

	rank := compactRankText(s.AllTimeRank)
	f.paintText(ctx, rank, in.Right(), f.baseline(in.Y, 34, rankStyle), rankStyle, rankPaint(s.AllTimeRank), alignRight)
	f.text(ctx, "All Time", in.Right(), f.baseline(in.Y+34, 17, allTimeStyle), allTimeStyle, alpha(white, 0.5), alignRight)

	textX := in.X + 60
	textW := in.Right() - textX - math.Max(f.width(rank, rankStyle), f.width("All Time", allTimeStyle)) - 10
	f.text(ctx, f.truncate(p.title, titleStyle, textW), textX, f.baseline(in.Y+3.5, 22, titleStyle), titleStyle, white, alignLeft)

	points := compact(s.Points) + " Points"
	if s.Points == 1 {
		points = "1 Point"
	}
	f.text(ctx, f.truncate(points, pointsStyle, textW), textX, f.baseline(in.Y+27.5, 19, pointsStyle), pointsStyle, white, alignLeft)

	// row 2: day, week and month chips.
	x := in.X
	x += drawRankChip(ctx, f, p.accent, x, in.Y+61, "Day", s.DailyRank) + 10
	x += drawRankChip(ctx, f, p.accent, x, in.Y+61, "Week", s.WeeklyRank) + 10
	drawRankChip(ctx, f, p.accent, x, in.Y+61, "Month", s.MonthlyRank)

	// row 3: progress to the next role.
	drawProgressBar(ctx, f, p.accent, Rect{in.X, in.Y + 100, in.W, 22}, s.Progress)
}

// drawRankChip draws a "Week #2" chip and returns its width.
func drawRankChip(ctx *canvas.Context, f *Fonts, accent activityAccent, x, y float64, label string, rank int) float64 {
	const (
		h    = 29
		padX = 10
		gap  = 5
	)

	value := compactRankText(rank)
	lw, vw := f.width(label, chipLabelStyle), f.width(value, chipValueStyle)
	r := Rect{x, y, padX + lw + gap + vw + padX, h}

	// black with the accent's first colour at 20%. The border is the same colour, fading from
	// 50% at the top to 20% at the bottom, so it matches whatever the panel is themed on.
	from := accent.from()
	fillRoundRect(ctx, r, h/2, solid(color.Black))
	fillRoundRect(ctx, r, h/2, solid(alpha(from, 0.2)))
	strokeRoundRect(ctx, r, h/2, 1, vgrad(
		gradientStop{0, toRGBA(alpha(from, 0.5))},
		gradientStop{1, toRGBA(alpha(from, 0.2))},
	))
	f.text(ctx, label, x+padX, f.baseline(y+6, 17, chipLabelStyle), chipLabelStyle, alpha(white, 0.5), alignLeft)
	f.text(ctx, value, x+padX+lw+gap, f.baseline(y+5, 19, chipValueStyle), chipValueStyle, white, alignLeft)

	return r.W
}

// drawProgressBar draws an outlined track, filled with the accent up to the member's progress.
// The fill's gradient spans the whole track. A nil progress is drawn full, as MAX.
func drawProgressBar(ctx *canvas.Context, f *Fonts, accent activityAccent, r Rect, progress *Progress) {
	radius := r.H / 2

	fraction, label := 1.0, "MAX"
	if progress != nil {
		fraction = 0
		if progress.Required > 0 {
			fraction = math.Max(0, math.Min(1, float64(progress.Current)/float64(progress.Required)))
		}
		label = compact(progress.Current) + " / " + compact(progress.Required)
	}

	if fraction > 0 {
		fill := Rect{r.X, r.Y, math.Max(r.H, r.W*fraction), r.H}
		setFill(ctx, accent.paint(), r)
		ctx.SetStrokeColor(transparent)
		ctx.DrawPath(0, 0, roundRect(fill, radius))
	}
	strokeRoundRect(ctx, r, radius, 1, accent.paint())

	base := f.baseline(r.Y+0.33, r.H, progressStyle)
	f.blurredShadow(ctx, label, r.X+r.W/2, base+2, progressStyle, 0.5, 2.5, alignCenter)
	f.text(ctx, label, r.X+r.W/2, base, progressStyle, white, alignCenter)
}
