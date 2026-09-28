# Spotter · "Log activity" drawer — 8 redesign variants (one variant = one row of 2 artboards)

## Context (the real app today)

Spotter is a gym PWA (dark graphite UI). The Start sheet has an "Activity" tile → it opens this bottom drawer "Log activity" (caption: "Cardio, sports & recovery count too — so Spotter sees your whole load."). Today it is ONE long scrolling grid of 3-column tiles (icon + name) in three groups:

- CONDITIONING (gold icons): Run, Cycling, Swim, Rowing, Walk, HIIT, Dance, Cardio, Hiking, Elliptical, Stair climber, Jump rope, Pilates
- SPORTS (green icons): Football, Basketball, Volleyball, Tennis, Padel, Badminton, Table tennis, Boxing, Martial arts, Climbing, Hockey, Skiing, Snowboard, Golf, Other sport
- RECOVERY (blue icons): Yoga, Mobility, Massage, Sauna, Cold plunge
  33 tiles → a lot of scrolling, no search, no recents, every choice looks equal, and a tap only opens a separate activity page (there: Start now with a live timer, or "Log a past one" with date/time, Duration, Distance (run/cycle/swim/row/walk/hike/ski), Effort Light/Moderate/Hard, calories estimate from MET × body weight, badge "Adds conditioning load" / "Counts as recovery"). The owner says the UX now suffers badly. Also: the app knows the user's history (e.g. Dance 125 min last Saturday, runs), typical weekday/time patterns, and whether a session/activity is live.

## Goal

8 genuinely different UX answers for picking (and ideally quick-logging) an activity fast — fewer taps, less scrolling, the frequent ones first, easy to find a rare one. Keep all 33 types reachable. Keep the three colour families (conditioning gold #d9a24f, sports green #a8dc7c, recovery blue #93d4f2).

## MUST in every variant (owner's request)

1. **Pinning.** The user can pin favourite activity types; pinned ones show first (a "Pinned" area or row) and there is a visible, obvious way to pin/unpin (pin icon on the item, long-press hint, or an "Edit pins" mode — show the mechanism in one of the two artboards). Sample pins: Run, Dance, Sauna.
2. **Automatic day-pattern suggestions.** A smart line/block from history: what the user usually does on this weekday/time, e.g. "Saturdays you usually: Dance · ~2 h, then Sauna" or "Most Mondays after lifting: Walk 20 min", with one-tap start/log for each suggestion. Make it feel helpful, not noisy; say it's based on their history ("from your last 6 Saturdays").
   These two must be integrated in each variant's own way, not bolted on identically.

## Output per variant: exactly 2 artboards, phone 390×844

- `vNN-a.dc.html` — the drawer as it opens (default state).
- `vNN-b.dc.html` — the variant's key interaction state (e.g. search typed "box", a category tab switched, a type selected with the inline quick-log panel expanded, "All activities" expanded, favourites edit, etc.). Pick what best shows the variant's idea.
  Exception: the file for v01-a must be named `Main.dc.html` (the canvas entry); everything else `vNN-a` / `vNN-b`.
  Write each with the Write tool to `/tmp/claude-0/-home-claude/5348e853-81cd-5c1f-b77d-75609fa5f6ba/scratchpad/drawer/project/<file>`.

## Frame & look (match the real app)

- Artboard root 390×844, background: the app behind — #16171a with a dimmed hint of the Today screen at the top (header row: script wordmark "spotter" in 'Kaushan Script' 22px #e9eaec + small caps "GYM" in #d9a24f 11px letter-spacing .2em; three 40×40 radius-14 icon buttons outlined rgba(233,234,236,.14)); a scrim rgba(0,0,0,.45) over it; the drawer sits at the bottom with top radius 20px, background #1f2125 (slightly lighter than bg), 1px top hairline rgba(233,234,236,.10), grabber 34×4 radius 2 #55595e centred 10px from top. The drawer may be tall (up to ~780px) — content that doesn't fit clips at the bottom like a scrolled sheet.
- Tokens: text #e9eaec, muted #90959a, faint #71767b, tile #262a2d with 1px border #3b3f43, radius 14 (tiles), 8 (chips), divider rgba(233,234,236,.14); accent gold #d9a24f (accent-900 #342713 for selected tints); sports #a8dc7c (tint #1f2f14); recovery #93d4f2 (tint #0e2a3b). Buttons are OUTLINED (border + text in colour), primary action may be a filled gold pill with #1b1409 text only for the single main CTA. No gradient washes, no left-border cards, no emoji.
- Font: Inter (Google Fonts css2 link in `<helmet>`, weights 400/500/600/700) + Kaushan Script for the wordmark only; tabular numbers.
- Icons: inline stroke SVG (1.75px, currentColor, 20–24px), simple and recognisable (runner, bike, waves, ball, racket, glove, mountain, snowflake, flame, lotus…). Your own drawings.
- Copy in English, exact type names as above. Realistic data: recents like "Dance · 125 min · Sat", "Run · 5 km · 30 min · Thu", "Sauna · 20 min · Sun".
- Touch targets ≥ 44px. Real `<button>`, `<input>` + `<label>`, `aria-label` on icon-only buttons. Inputs for search are real `<input type="search">`.

## File format (.dc.html) — rules that fail silently

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>V03 · Search typed</title>
    <script src="./support.js"></script>
  </head>
  <body>
    <x-dc>
      <helmet>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Kaushan+Script&display=swap"
          rel="stylesheet"
        />
        <style>
          body {
            margin: 0;
            background: #16171a;
          }
          a {
            color: #d9a24f;
            text-decoration: none;
          }
          a:hover {
            color: #e8b86a;
          }
        </style>
      </helmet>
      <div
        style="width: 390px; height: 844px; position: relative; overflow: hidden; box-sizing: border-box; background: #16171a; color: #e9eaec; font-family: Inter, sans-serif"
      >
        ...
      </div>
    </x-dc>
    <script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":390,"height":844}}'>
      class Component extends DCLogic {
      renderVals() { return {}; }
      }
    </script>
  </body>
</html>
```

- Keep `<script src="./support.js"></script>` EXACTLY. Close every non-void element; quote every attribute. `{{hole}}` only dotted lookups from renderVals (no expressions). Static mockups are fine (you may use `<sc-for>` over arrays from renderVals to avoid repetition). No images, data URIs, iframes, emoji, network except the font link.
- Layout with flex / `display: grid; grid-template-columns: repeat(N, minmax(0, 1fr))` + gap. Put `flex-shrink: 0` on stacked blocks.
- `<title>` = "VNN · <state>".
- Prototype link: in vNN-a make the element that leads to the b-state an `<a href="vNN-b.dc.html">` styled as that element (for v01: `v01-b.dc.html`; from v01-b back: `Main.dc.html`). No `<button>` inside `<a>`.

When done reply ONLY with JSON: `{"NN":{"name":"≤4 words","idea":"one sentence","a":"≤26 chars state title","b":"≤26 chars state title"}, …}` for each variant you made.
