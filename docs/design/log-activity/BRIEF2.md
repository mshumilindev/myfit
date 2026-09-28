# Spotter · "Log activity" — merged final design (full page, all states, + web)

Read first: BRIEF.md (context, tokens, file format rules, pinning + day-pattern requirements) in this folder, then the owner's favourite variants in `project/`:

- `v04-a.dc.html` — take its TOP part (the "Likely now" hero card with the prediction from history + the smaller suggestions).
- `v05-a.dc.html`, `v05-b.dc.html` — take the app-store carousels (Pinned row, one sideways row per group with "See all ›", the See-all full grid with pin toggles).
- `v03-b.dc.html` — take the quick-log UI (duration presets 15/30/45/60/90 + custom, When: Now / Earlier today / Yesterday (+ date/time when earlier), Effort Light/Moderate/Hard, live kcal, distance for distance types, Pin toggle, "Start timer" + "Log it").
  Reuse their exact visual language (copy markup/styles where helpful) so the result feels like one product.

## Change: it's no longer a drawer — a full page

A normal Spotter page (like other full screens): top app header (script "spotter" + small caps "GYM", 3 outlined 40×40 icon buttons), then a page bar with a back chevron button (aria-label "Back"), title "Log activity", and a search icon button at the right. Background #16171a, content cards #1f2125 / tiles #262a2d. Mobile: bottom tab bar is NOT shown on this page (it's opened from Start), respect ~24px bottom padding. Quick-log opens as a bottom sheet over the page on mobile (radius 20, grabber, scrim) — that sheet is the v03 quick-log panel.

## Owner updates (override anything above)

- SEARCH IS ALWAYS VISIBLE on the Log activity page: a real search field ("Search activities") sits right under the page bar on every state of the page (sticky when scrolling), not behind an icon. Category pages keep their own in-category search field in the same place.
- "Category first" is merged too: three compact category cards (Conditioning 13 · Sports 15 · Recovery 5, colour-coded, 3 mini icons, "last: …") sit between Pinned and the carousels and open the category page (m02 / w03), like v06.
- m01–m04 and w01–w03 already exist in project/: match them exactly (read m01 first).

## Artboards (write each with the Write tool into `project/`)

Mobile 390×844 (tall pages may be 390×1200 when a state needs to show the full scroll — say so in the title):

- `m01-default.dc.html` — Default: Likely-now hero ("Saturday evening — Dance? The last 4 Saturdays, ~2 h" · Start / Log 2 h), 2 smaller suggestions (Sauna 20 min after Dance; Walk 30 min), Pinned carousel (Run, Dance, Sauna, + "Pin" add card), then Conditioning / Sports / Recovery carousels with See all. Height 1200 to show the whole page.
- `m02-see-all.dc.html` — See all Sports: page with back to Log activity, title "Sports · 15", in-category search field, grid (3 cols) of cards with pin toggle (Tennis pinned state shown), last-logged meta where known.
- `m03-quicklog.dc.html` — Quick-log sheet open for Tennis over the page: presets (60 selected), When = Now, Effort = Moderate, kcal "≈ 610 kcal", Pin toggle, Start timer (outlined) + Log it (filled gold primary).
- `m04-quicklog-earlier.dc.html` — Same sheet for Run with When = Earlier today → time field 07:30, Duration 30 min, Distance 5.0 km with pace "6:00 /km", Effort Hard, kcal.
- `m05-search.dc.html` — Search open: field with "bo" typed, results rows (Boxing, Snowboard, Bouldering → Climbing synonym, Other sport fallback "Log 'bo…' as Other sport"), recent searches hidden while typing.
- `m06-logged.dc.html` — Right after "Log it": page with a success toast/snackbar ("Tennis · 60 min logged · Undo"), the hero updated (e.g. suggestion moves to "Sauna 20 min after Tennis?"), a small "Today" strip showing the logged item.
- `m07-live.dc.html` — Something is live (an activity timer running: "Dance · 42:10 running"): a sticky resume banner at the top ("Dance in progress · 42:10 · Resume / Finish"); starting another is locked (tiles dimmed with lock hint "Finish Dance first"), logging a PAST activity still allowed.
- `m08-first-time.dc.html` — New user with no history: no prediction; friendly hero "Log anything you do outside the gym — it counts toward your recovery and load", 4 popular starters, a pin hint ("Tap ☆ to pin the ones you do often" — use a pin icon, not an emoji), carousels as usual.

Web 1280×800 (desktop app layout: left icon rail 64px like Spotter desktop, content max ~1160):

- `w01-default.dc.html` — Two columns: left = hero + suggestions + pinned + carousels (wider, rows show more cards, arrows ‹ › on carousels), right = a sticky "Quick log" panel (360px) with an empty state ("Pick an activity") and Today's logged list.
- `w02-quicklog.dc.html` — Tennis selected: its card highlighted in the carousel; right panel shows the full quick-log (presets, when, effort, kcal, pin, Start timer / Log it).
- `w03-see-all.dc.html` — See all Sports as a 5-column grid with search + pin toggles, right panel still present (showing Run quick-log with Earlier today).

Titles: "M01 · Default", … "W03 · See all + panel". Prototype links: m01 See all Sports → m02; tapping Tennis in m01 → m03; search icon → m05; back in m02/m05 → m01; Log it in m03 → m06; w01 Tennis → w02; w01/w02 See all → w03.
Everything else per BRIEF.md (tokens, colours by group, pinning, day-pattern suggestions "from your last 6 Saturdays", accessibility, no emoji). Don't render or verify.
When done reply ONLY with JSON {"file": "title", …}.
