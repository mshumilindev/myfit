# Claude Design prompt — Spotter "Recaps" (monthly / quarterly / yearly)

_Paste everything below the line into Claude Design. It's written as a direct brief; tighten or trim any section before sending._

---

Design a **"Recaps"** feature for **Spotter**, a personal gym-training tracker (a mobile-first PWA that also runs on desktop). A recap is a period summary of someone's training — think _Spotify Wrapped, but for lifting_ — generated automatically for **each finished month, each quarter, and each year**. Design the entry point, the recap itself, and a shareable summary card. Produce **mobile artboards (390 px wide) first**, then a **desktop** variant of the recap.

## Product & visual language (match it exactly)

Spotter is dark, quiet, and numeric — no clutter, no bright chrome.

- **Surfaces:** near-black background (~~`#131417`), cards on a slightly lighter charcoal (~~`#1f2125`), hairline dividers (white at ~14% opacity). Generously rounded cards (14–18 px radius).
- **Accent:** warm gold (~~`#e9c07a`) for the primary/active state and highlights. A blue (~~`#3d84c9`) is used only for calories, always paired with a small flame icon.
- **Type:** clean sans. Section labels are **small-caps, letter-spaced, muted** (e.g. `TOTAL VOLUME`). Big numbers are **hero-sized with tabular figures**. Body copy is calm grey.
- **Existing patterns to reuse:** stat "heroes" (a huge number + a small-caps label + a tiny delta), pill/chip rows, a front/back **anatomical muscle map** that tints worked muscles, a flame+number calorie chip, and up-arrow "open" affordances. Keep icons line-weight and minimal.
- **Tone:** confident but understated. One evocative line per period, never hype. It should feel like a coach's end-of-period note, not a carnival.

## What a recap contains (the data Spotter already tracks)

Design sections around these. Not every section must appear on every period — pick a strong ordering and show what carries a story.

1. **Header / identity.** The period ("September 2026", "Q3 2026", "2026"), and one earned headline line (e.g. _"Your highest-volume month yet."_ / _"Consistency was the story."_). A small Spotter mark.
2. **The totals row.** Hero numbers: **sessions**, **total volume** (tonnage in kg — this can be huge, e.g. 142,000 kg, so design for 3–6 digit numbers), **time trained** (hours), **total sets** and **reps**, **calories** (flame). Each with a **delta vs the previous period** (▲ +18% / ▼ −6%).
3. **Highlights / records.** New **personal records** this period (a count, plus the 2–3 best named: exercise + weight or estimated 1RM), the **heaviest single set**, and the **biggest session** (by volume). Records are a big deal — give them a proud, card-forward treatment.
4. **Muscle distribution.** Which muscle groups got the most work, shown on the **anatomical body map** (front + back, worked areas tinted gold by intensity) and/or a short ranked bar list (Quads, Back, Chest…). Optionally flag an under-trained area gently.
5. **Consistency.** Training days, current/゙longest **streak**, **perfect weeks** (weeks hitting the target session count), and a **weekday pattern** (which days they actually train — a small 7-dot or bar strip).
6. **Trend.** A simple **volume-over-the-period** shape (bars or a sparkline — weeks for a month, months for a year) and the **vs-previous-period** comparison stated plainly.
7. **Goals.** Progress toward the athlete's **physique target** and how well the block **focus** (which muscles they chose to grow) was served — a short "you trained toward your goal" readout.
8. **Activities.** Non-lifting work logged alongside training — a **recovery vs conditioning** split (minutes, calories), kept secondary to the lifting story.
9. **Closing / share.** A final **shareable card** (see below).

## Screens / artboards to deliver

- **A. Recaps index.** How a person finds recaps — a list of period cards ("This month" in progress, plus finished months, the latest quarter, the year). Each card: period name, a hero stat or two, a thumbnail feel, and an open affordance. Show where this lives (it belongs in the Progress area of the app).
- **B. The recap — two directions, design both so the choice is visible:**
  - **B1. A vertically scrolling recap** — a hero, then the sections above as stacked cards. This is the reference/reading view.
  - **B2. A paged "story"** — full-screen swipeable panels (Wrapped-style): one big idea per panel (the totals, the PRs, the muscle map, the streak, the closing card), with a thin progress bar at top. Design 4–6 of these panels.
- **C. The share card.** A single **portrait card (1080×1350-ish)**, Spotter-branded, that distills the period into a few numbers a person would actually post: period, sessions, total volume, PRs, maybe the muscle map. Self-contained and legible as a thumbnail.
- **D. Desktop recap.** The scrolling recap (B1) re-laid for a wide screen — multi-column where it helps, the muscle map and trend given room. Keep the same components, just re-flowed.

## Constraints & details

- **Mobile-first**, 390 px; nothing may overflow horizontally; wide content (trend, muscle map) fits the column.
- Design in **dark mode** (the app's default). If easy, note how a light variant would invert.
- Copy is in **English placeholder**, but the app ships in 5 languages — so **don't bake numbers into words** or rely on tight, untranslatable strings; leave labels room to grow ~30%.
- Use **realistic sample data** (a strong month: ~14 sessions, ~140 t volume, 3 PRs, quads/back-led) so the layout is tested against real magnitudes — including the awkward ones (6-digit tonnage, a 0-PR quiet month, a first-ever month with no previous period to compare).
- Show at least one **empty/edge state**: a period with too little data to recap ("Not enough sessions this month yet").
- Every number that changes over time should have a clear **delta treatment** (up = gold/positive, down = muted, never alarmist red for a normal dip).

Deliver the artboards on one canvas, grouped: **Index → Recap (scroll) → Recap (story panels) → Share card → Desktop.**
