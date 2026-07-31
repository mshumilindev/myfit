I've now read 100% of both files (631 lines and 825 lines respectively), plus the underlying design-system stylesheet for the shared component classes. Full inventory below.

---

# My Fit — Implementation Inventory

Source files:

- `/home/claude/design/My Fit - All States (Web).dc.html` — static web/desktop state board, frames **W-01 … W-13**
- `/home/claude/design/My Fit - Graphite.dc.html` — clickable prototype (phone + desktop) with a `DCLogic` component
- `/home/claude/design/_ds/nocturne-9cf7d899-d545-405d-beb1-b63d8ef83897/styles.css` — the Nocturne DS classes both files consume (`.btn`, `.input`, `.table`, `.tag`, `.seg`, `.card`, `.dialog`)

---

## 0. Shared foundation

### 0.1 Theme override (identical in both files, declared in `<helmet><style> :root`)

```
--color-bg: #16171a;      --color-surface: #1f2125;   --color-text: #e9eaec;
--color-divider: rgba(233,234,236,0.14);
--color-accent: #d9a24f;  /* brass */
--color-accent-100 #fbf3e6  -200 #f6e6cb  -300 #eed3a5  -400 #e4bb76
--color-accent-500 #d9a24f  -600 #b3833d  -700 #8a642e  -800 #5b4420  -900 #342713
--color-neutral-100 #f5f6f7 -200 #e6e8ea -300 #d0d3d6 -400 #b0b4b8 -500 #90959a
--color-neutral-600 #71767b -700 #55595e -800 #3b3f43 -900 #262a2d
--shadow-sm: 0 0 0 1px #3b3f43;
--shadow-md: 0 0 0 1px #55595e, 0 6px 18px rgba(0,0,0,0.6);
--shadow-lg: 0 0 0 1px #6b7075, 0 18px 44px rgba(0,0,0,0.7);
--color-ok: #4cbe8c;      --color-ok-text: #b7e8cf;      --color-ok-tint: #16291f;      --color-ok-line: #2f6f52;
--color-danger: #e2564f;  --color-danger-text: #f3c2bf;  --color-danger-tint: #2c1614;  --color-danger-line: #7d302b;
```

Page background differs: web board `body { background:#0d0e10 }`, prototype `body { background:#0f1012 }`.

### 0.2 DS tokens inherited (not overridden)

`--space-1: 2.8px · --space-2: 5.6px · --space-3: 8.4px · --space-4: 11.2px · --space-6: 16.8px · --space-8: 22.4px`
`--radius-sm: 4px · --radius-md: 8px · --radius-lg: 14px`
`--font-heading / --font-body: "Inter", system-ui, sans-serif`

### 0.3 DS component classes used

| Class                                                                                 | Key rules                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.btn`                                                                                | inline-flex, gap 6, font-size 14, radius `--radius-md`, padding `var(--space-2) calc(var(--space-3)*1.2)`, transparent bg, 1px transparent border                                                                                                                                                |
| `.btn-primary`                                                                        | `color/border-color: var(--color-accent)`; hover `accent 12%`, active `accent 22%` — **outline button, never a filled brass slab**                                                                                                                                                               |
| `.btn-secondary`                                                                      | `border-color: var(--color-divider)`; hover text 7%, active text 14%                                                                                                                                                                                                                             |
| `.btn-ghost`                                                                          | accent text, `padding-inline: var(--space-1)`; hover accent 10%                                                                                                                                                                                                                                  |
| `.btn-icon`                                                                           | 36×36, padding 0                                                                                                                                                                                                                                                                                 |
| `.btn:disabled`                                                                       | `opacity: .45; cursor: not-allowed`                                                                                                                                                                                                                                                              |
| `.input`                                                                              | full width, `min-height 36px`, padding 6/10, bg surface, 1px divider border, radius md, `caret-color: accent`; hover border text 45%; `:focus-visible` border accent                                                                                                                             |
| `.table`                                                                              | `width:100%; border-collapse:collapse; font-size:14px`; `th` = 11px, `.08em` tracking, uppercase, text@60%; `td/th` padding `--space-2`; **row rules are row-level gradient strips that fade out in the first/last 48px**; `tbody tr:hover` layers a `text 4%` tint over the still-painting rule |
| `.tag` / `.tag-accent` / `.tag-neutral` / `.tag-outline`                              | 11px, padding 3/10, radius `calc(var(--radius-md)*0.75)`; accent = bg `accent-800` / fg `accent-100`; neutral = bg `neutral-800` / fg `neutral-100`                                                                                                                                              |
| `.seg` / `.seg-opt`                                                                   | inline-flex bordered group, 13px, padding 7/12, `+ .seg-opt` left divider; checked → accent text + `inset 0 0 0 1px accent`                                                                                                                                                                      |
| `.dialog-backdrop` / `.dialog` / `.dialog-title` / `.dialog-body` / `.dialog-actions` | dialog `width: min(440px,100%)`, radius lg, surface bg, `--shadow-lg`, actions right-aligned                                                                                                                                                                                                     |

### 0.4 Animation classes

Web board: `.sk` (skeleton, `shimmer 1.6s ease-in-out infinite`, bg `#262a2d`, radius 6), `.sp` (`spin 1s linear infinite`).
Prototype: `.tapbtn` (transition bg/color/border-color .16s, `:active { transform: scale(0.985) }`), `.row-in` (`rowIn .28s cubic-bezier(.2,.7,.3,1)` — from `opacity 0, translateY(-5px)`), `.fade-in` (`fadeIn .2s`), `.breathe` (`breathe 2.6s ease-in-out infinite`, opacity .45 ↔ 1), `.mf ::-webkit-scrollbar { width:0;height:0 }`.

### 0.5 Board page header (web file, verbatim)

- Eyebrow: `My Fit` / `Web & desktop states`
- H1: `The same product at 1280 px`
- Deck: `The browser app, the desktop window and the tray popover — every state the phone board carries, plus what only exists here: hover, keyboard focus, context menus, the two-pane history, narrow-window collapse and the shortcut sheet. Reference ids are W-01 … W-13; they pair with S-xx on the phone board.`

Section headers: `W · A` **Auth** `W-01 → W-02 · centred card, window chrome` · `W · B` **Today** `W-03 → W-05 · rail, main column, right panel` · `W · C` **Live session** `W-06 → W-11 · keyboard logging, editing, deleting` · `W · D` **History, progress, gyms** `W-10 → W-13 · two-pane, charts, location errors`

### 0.6 Recurring desktop shell skeleton

```
frame            1120 × 700, bg --color-bg, radius 12, box-shadow --shadow-md, overflow hidden, display flex
├ left rail      width 206px, flex none, padding 16px 12px, flex-column, gap 4 (8 in skeleton),
│                box-shadow: 1px 0 0 var(--color-divider)
│  ├ brand row   padding 6px 8px 16px, gap 8 · <i class="ph-bold ph-barbell" 19px accent> + "My Fit" 16px
│  ├ nav item    padding 9px 10px, radius --radius-md, gap 10, font 14, icon 17px
│  │    active   background: var(--color-accent-900); color: var(--color-accent)
│  │    idle     color: var(--color-neutral-400)
│  │    hover    background: rgba(233,234,236,0.05); color: var(--color-neutral-300)
│  │    disabled color: var(--color-neutral-600); opacity: .5
│  └ footer      margin-top:auto — account chip / sync chip / in-session chip
├ main column    flex 1, padding 26px 30px, flex-column, gap 20–24, min-width 0
└ right panel    width 330px, flex none, padding 26px 22px, gap 12–14,
                 box-shadow: -1px 0 0 var(--color-divider)
```

Window-chrome bar (W-01/W-02/W-13-mid): `height 38px (34px at 400px), background #1b1d21, padding 0 14px`, three 11px `#3b3f43` circles, centred 12px `--color-neutral-600` label.

Keycap chip pattern (used on every shortcut hint):
`font-size:11px; border:1px solid var(--color-divider) [or --color-accent-700 inside btn-primary]; border-radius:4px; padding:1px 5px; margin-left:6–8px`

---

# PART 1 — Web frames W-01 … W-13

---

## W-01 · Sign in · idle & submitting

**Purpose:** the browser auth entry; centred 380px card inside window chrome; demonstrates focus ring and Enter-to-submit.

**Layout skeleton**

```
frame 1120×700 (flex column)
├ window chrome  height 38, "My Fit — myfit.app"
└ body           flex:1; display:grid; place-items:center
   └ card        width 380; flex-column; gap var(--space-3)
      ├ brand row       gap 10 · ph-bold ph-barbell 24px accent + "My Fit" 20px
      ├ subtitle        13px neutral-500, margin-bottom var(--space-4)
      ├ input.input     min-height 44
      ├ input.input[type=password]  min-height 44
      │     focused: border-color accent + box-shadow 0 0 0 3px rgba(217,162,79,0.14)
      ├ hint 11px neutral-600
      ├ button.btn.btn-primary  min-height 44, font 15, margin-top var(--space-2) + keycap
      └ footer link 12px neutral-600, centred, padding-top 6
```

**Strings (verbatim)**

- `W-01` · `Sign in · idle & submitting`
- `My Fit — myfit.app`
- `My Fit`
- `Everything you lift, in one place.`
- placeholder `Email or username`
- placeholder `Password`
- `Focus ring: 2px brass, offset 2 — keyboard order is username → password → submit.`
- `Sign in`
- `New here? Create an account`
- caption `Card is 380 px and optically centred; the window never stretches the form. Enter submits from any field.`

**Keyboard:** `↵` keycap inside the **Sign in** button (brass-bordered variant). Tab order stated as username → password → submit; Enter submits from any field.

**Hover/context menus:** none. Focus ring only.

---

## W-02 · Sign in · hub unreachable + wrong password

**Purpose:** two blocking failure modes side by side; inline errors, never toasts.

**Layout skeleton**

```
frame (flex column) → chrome bar → body flex row, align center, justify center, gap 60
├ left card  380px  — unreachable server
│   brand row · danger banner · 2 × input.input[disabled]
│   row(gap 9): button.btn.btn-primary[disabled] flex:1  +  button.btn.btn-secondary "Retry" (ph-arrow-clockwise)
└ right card 380px, opacity .9 — credentials rejected
    kicker · input(value andrii) · input[type=password] border-color danger
    error line (ph-warning-circle 14 danger) · btn-primary · note
```

Danger banner: `padding 12px 13px; radius --radius-md; background var(--color-danger-tint); box-shadow: inset 0 0 0 1px var(--color-danger-line)`, icon `ph-bold ph-cloud-slash` 16px danger, text 12px/1.5 `--color-danger-text`.

**Strings (verbatim)**

- `W-02` · `Sign in · hub unreachable + wrong password`
- `Can't reach the server. Check your connection and try again — anything logged offline is still queued.`
- placeholders `Email or username`, `Password`
- `Sign in` (disabled), `Retry`
- `Variant · credentials rejected`
- input value `andrii`, password value `••••••`
- `Wrong username or password`
- `Sign in`
- `Both errors are inline. The desktop never uses a toast for a blocking failure.`
- caption `Two failure modes side by side: an unreachable server disables the form; a rejected password does not.`

**Keyboard:** none shown. **Hover/context:** none.

---

## W-03 · Today · skeleton

**Purpose:** loading state; all three columns skeleton simultaneously.

**Layout skeleton** — full 3-column shell. Rail: brand row, then `3 × div.sk (height 34)`, 1px divider (`margin 10px 8px`), `2 × div.sk (height 28)`; rail gap 8. Main (`gap 24`): title block (`sk 130×10`, `sk 220×30`), stat grid `repeat(4,1fr)` gap 12 of `sk height 76`, bar row `height 150; gap 10` with ten `sk` bars at `38/52/44/66/58/71/74/69/88/100 %`, list block (`sk 80×9` + `4 × sk height 14`). Right panel: `sk 90×9` + `2 × sk height 96 radius 8`.

**Strings:** `W-03` · `Today · skeleton`; caption `All three columns skeleton together — no column resolves early and shifts the others.`

**Keyboard / context:** none.

---

## W-04 · Today · filled, hover states

**Purpose:** the canonical desktop Today; shows rail hover, table-row hover, shortcut affordances, account chip.

**Layout skeleton**

```
rail 206  ├ brand
          ├ nav "Today"     ACTIVE   bg accent-900 / color accent  (ph-house)
          ├ nav "Progress"  idle     neutral-400                   (ph-chart-line-up)
          ├ nav "Gyms"      HOVER    bg rgba(233,234,236,0.05), color neutral-300 (ph-map-pin)
          │                          + right-aligned 10px label "hover"
          ├ divider (margin 12px 8px)
          ├ section label "Services" (10px, .1em, uppercase, neutral-600, padding 0 10px 8px)
          ├ nav "Training"      neutral-300         (ph-barbell)
          ├ nav "Nutrition"     neutral-600 op .5   (ph-carrot)
          ├ nav "AI body scan"  neutral-600 op .5   (ph-robot)
          └ account chip  margin-top auto; padding 10px 8px; radius md; bg rgba(233,234,236,0.05)
                 avatar 24px circle bg accent-900 / color accent-300, glyph "A"
                 + "andrii" 13px neutral-300 + 7px --color-ok dot
main      ├ header row (align flex-end, space-between)
          │    kicker "Friday, 31 July" + h1 "Today" (32px, -0.025em)
          │    btn-primary "Start session" (ph-play) min-height 40 + keycap ⌘N
          ├ stat grid repeat(4,1fr) gap 12 — cards bg surface, radius md, padding 14px 16px,
          │    value 26px tabular-nums, label 10px .08em uppercase neutral-600
          ├ Weekly volume block — header row (kicker + delta) + bar row height 140, gap 10
          │    bars 1–5 neutral-800, 6 accent-800, 7–8 accent-700, 9 accent-600, 10 accent
          └ History block — kicker + table.table
right 330 ├ "Templates" kicker + 2 template cards (bg surface, 1px divider, radius md, padding 14)
          ├ divider
          └ "Records" kicker + 3 record rows (flex, name flex:1, tabular value, .tag.tag-accent)
```

Table columns: `Date | Session | Sets | Volume | Duration | (40px actions)`. **First row carries the hover tint `background: rgba(233,234,236,0.04)` and reveals a `ph-dots-three` in the last cell** (right-aligned, neutral-500).

**Strings (verbatim)**

- `W-04` · `Today · filled, hover states`
- rail: `My Fit`, `Today`, `Progress`, `Gyms`, `hover`, `Services`, `Training`, `Nutrition`, `AI body scan`, `andrii`
- `Friday, 31 July`, `Today`, `Start session`
- stats: `3` / `Sessions`, `14.2 t` / `Volume`, `2` / `New PRs` (accent), `21 d` / `Streak`
- `Weekly volume`, `+18% vs June`
- `History`; headers `Date`, `Session`, `Sets`, `Volume`, `Duration`
- rows: `Wed 29 Jul` `Push day` `18` `4 980 kg` `1:12` — `Mon 27 Jul` `Legs` + tag `Auto-closed` `14` `3 420 kg` `0:54` — `Sat 25 Jul` `Pull day` `21` `5 640 kg` `1:03` — `Thu 23 Jul` `Push day` `17` `4 610 kg` `1:08`
- `Templates`; `Push day` / `Bench · Incline DB · Dips · Lateral raise` / `Load template`; `Legs · heavy` / `Squat · RDL · Leg press · Calf raise` / `Load template`
- `Records`; `Back Squat` `110 kg` `+5`; `Bench Press` `82.5 kg` `+2.5`; `Deadlift` `140 kg`
- caption `Hover is a 4% text tint — shown on the rail item and the first table row. Every primary action carries its shortcut. The account chip at the bottom of the rail replaces the phone's Apps tab.`

**Keyboard:** `⌘N` keycap on **Start session**.
**Hover:** rail item tint `rgba(233,234,236,0.05)`; table row tint `rgba(233,234,236,0.04)` + overflow `⋮` (`ph-dots-three`) appearing in the trailing cell. No open context menu in this frame.

---

## W-05 · Today · empty · offline · sync failed

**Purpose:** three degraded states stacked in one frame; panels keep their frame when empty.

**Layout skeleton**

```
rail 206 — brand, Today (active), Progress, Gyms,
           footer: 7px danger dot + "Offline · 2 queued" (11px --color-danger-text, padding 10)
main flex-column gap 20
 ├ offline strip   padding 11px 14px; radius md; bg danger-tint; box-shadow: inset 3px 0 0 var(--color-danger)
 │                 icon ph-cloud-slash 16 danger
 ├ sync-failure card  padding 13px 14px; radius md; bg danger-tint; box-shadow: inset 0 0 0 1px danger-line
 │      ph-warning-octagon + copy + monospace-ish code line (11px, opacity .7, tabular-nums)
 │      actions: btn-secondary "Retry" (ph-arrow-clockwise, min-height 32)
 │               + outline-danger "Discard" (min-height 32; border 1px danger; color danger; transparent bg)
 └ empty block  flex:1; align-items flex-start; justify-content center; gap 14; max-width 46ch
        ph-barbell 30px neutral-700 · h 24px · body 14px/1.6 neutral-500
        buttons: btn-primary "Start session" (ph-play) + btn-secondary "Import from a CSV"
right 330 — "Templates" kicker + dashed placeholder
        border: 1px dashed var(--color-neutral-800); radius md; padding 16; 12px/1.55 neutral-600
```

**Strings (verbatim)**

- `W-05` · `Today · empty · offline · sync failed`
- `Offline · 2 queued`
- `No connection. 2 changes queued — they replay in order as soon as you are back online.`
- `Sync failed on change 3 of 6 — the server rejected a workout that no longer exists.`
- `409 · upsert workout 4f2c…`
- `Retry`, `Discard`
- `Nothing logged yet`
- `Start a session and this page fills with your weeks, records and trends. Templates appear after the second one.`
- `Start session`, `Import from a CSV`
- `Templates`
- `Keep a finished session and it lands here, ready to load with last time's weights.`
- caption `Three states stacked in one frame: offline banner, blocked queue, empty main. Panels keep their frame — an empty side panel shows a dashed placeholder, never a blank hole.`

**Keyboard:** none shown. **Hover/context:** none.

---

## W-06 · Session · logging, focused ghost row

**Purpose:** the desktop live-session screen — keyboard-first logging via a ghost table row; right panel is read-only reference.

**Layout skeleton**

```
rail 206 — Today(active) / Progress / Gyms
   footer "in session" chip: margin-top auto; padding 10; radius md; bg accent-900; gap 9
        8px accent dot + "In session" (12px accent-200) + clock 13px tabular accent-100
main flex-column gap 20
 ├ header row: kicker (accent) + h1 30px  |  right: 22px tabular clock + btn-secondary "Finish" + keycap ⌘⏎
 ├ stat row (flex gap 26, tabular-nums) — 20px value + 10px uppercase label
 ├ Exercise block A
 │   heading row: name 17px · "prev 85 × 8" 11px neutral-600 · right-aligned "1 385 kg moved"
 │   table.table max-width 620 — cols: Set(44px) | Reps | Weight | Type | (90px)
 │     row1 warm-up   → reps/weight/type all neutral-500
 │     row2 HOVERED   → background rgba(233,234,236,0.04); trailing cell shows
 │                      ph-pencil-simple (margin-right 10) + ph-trash (danger)
 │     row3 record    → Type cell colored var(--color-ok)
 │     row4 GHOST ROW → set # neutral-700
 │        reps  <span> min-width 46; padding 3px 8px; radius 6;
 │              border 1px var(--color-accent); box-shadow 0 0 0 3px rgba(217,162,79,0.14)  ← focused
 │        weight<span> min-width 46; padding 3px 8px; radius 6; border 1px neutral-800; color neutral-400
 │        type  "prefilled" neutral-700
 │        action btn-primary height 30, padding-inline 12, 12px — "Log ⏎"
 │   hint line 11px neutral-600
 ├ Exercise block B — heading + single-row table (no thead)
 └ btn-secondary "Add exercise" (ph-plus) align-self flex-start + keycap ⌘K
right 330
 ├ "Rest" kicker
 ├ rest card: bg accent-900; radius md; padding 16; gap 12 —
 │        ph-timer 18 accent-300 + "Since last set" 13px accent-200 + 20px tabular accent-100
 ├ divider
 ├ "Last time · Leg day" kicker + 3 reference rows (13px neutral-400, tabular right value)
 └ note
```

**Strings (verbatim)**

- `W-06` · `Session · logging, focused ghost row`
- `In session` · `24:18` (rail chip)
- `In session · Smartass Obolon` · `Leg day` · `24:18` · `Finish`
- stats `7`/`sets`, `2.1 t`/`moved`, `2`/`exercises`
- `Back Squat` · `prev 85 × 8` · `1 385 kg moved`
- headers `Set`, `Reps`, `Weight`, `Type`
- rows: `1 | 12 | 40 | warm-up`; `2 | 8 | 80 | working`; `3 | 8 | 85 | record`; ghost `4 | 8 | 85 | prefilled` + `Log ⏎`
- `Tab moves reps → weight → Log. ⌥↑ / ⌥↓ nudges weight by 2.5 kg. Hovering a logged row reveals edit and delete.`
- `Romanian Deadlift` · `prev 70 × 10` · row `1 | 10 | 70 | working`
- `Add exercise`
- `Rest` · `Since last set` · `1:24`
- `Last time · Leg day`; `Back Squat` `3 × 8 · 85 kg`; `Romanian Deadlift` `3 × 10 · 70 kg`; `Leg Press` `3 × 12 · 160 kg`
- `The right panel is reference only — nothing here is editable, so the eye always knows where input happens.`
- caption `Desktop logging is keyboard-first: the ghost row is two real fields plus Enter, and the phone's stepper disappears.`

**Keyboard shown:** `⌘⏎` on Finish · `⏎` inside the Log button · `⌘K` on Add exercise · in the hint: `Tab` (reps → weight → Log), `⌥↑ / ⌥↓` (±2.5 kg).
**Hover:** logged row 2 shows the 4% tint plus edit (pencil) and delete (trash, danger) icons in the trailing cell.

---

## W-07 · Set · inline edit & row context menu

**Purpose:** in-place row editing plus the right-click set menu with shortcut teaching.

**Layout skeleton**

```
frame position:relative
rail 206 (brand only)
main flex-column gap 20
  h1 "Leg day" 30px
  heading row (name 17 + "prev 85 × 8")
  table.table max-width 620 — cols Set(44) | Reps | Weight | Type | (120px)
     row2 = EDIT MODE:
        reps  span min-width 46, border 1px accent, box-shadow 0 0 0 3px rgba(217,162,79,0.14)
        weight span min-width 52, border 1px neutral-800
        type  <span class="tag tag-neutral">warm-up ⇧W</span>
        trailing cell right-aligned 11px neutral-500 hint
  hint 11px neutral-600
context menu (absolute; left 420; top 330; width 250; bg surface; radius md; --shadow-lg; padding 6)
  header label 10px .1em uppercase neutral-600, padding 8px 10px 6px
  item: flex; gap 10; padding 9px 10px; radius 6; font 13; icon 15px neutral-400;
        shortcut right-aligned (margin-left auto) 11px neutral-600
  hovered item: background rgba(233,234,236,0.05)
  divider 1px, margin 4px 8px
  destructive item: color var(--color-danger), shortcut opacity .7
```

**Strings (verbatim)**

- `W-07` · `Set · inline edit & row context menu`
- `Leg day`, `Back Squat`, `prev 85 × 8`
- headers `Set`, `Reps`, `Weight`, `Type`
- rows `1 | 12 | 40 | warm-up`; edit row `2 | 8 | 82.5 |` tag `warm-up ⇧W` | `⏎ save · esc cancel`; `3 | 8 | 85 | record`
- `Double-click or ⏎ on a row edits it in place — no modal, the table never reflows.`
- Context menu: `Set 2 · right-click` — `Edit` `⏎` · `Duplicate` `⌘D` · `Mark as warm-up` `⇧W` · `Delete set` `⌫`
- caption `Right-click is a first-class desktop path; every item shows its shortcut so the menu teaches the keyboard.`

**Keyboard shown:** `⏎` save / `esc` cancel on the edit row; `⇧W` on the type tag; menu shortcuts `⏎`, `⌘D`, `⇧W`, `⌫`; `Double-click or ⏎` opens edit.
**Context menu trigger:** right-click on a set row. Menu icons: `ph-pencil-simple`, `ph-copy`, `ph-flame`, `ph-trash`.

---

## W-08 · Exercise · rename, menu, delete dialog, undo

**Purpose:** all four exercise-level editing surfaces in one frame.

**Layout skeleton**

```
frame position:relative
rail 206 (brand only)
main flex-column gap 26
 ├ § "Rename in place"
 │    row max-width 520, gap 10:
 │      input.input flex:1 min-height 38 font 16, border accent + 0 0 0 3px rgba(217,162,79,0.14)
 │      btn-primary height 38 "Save ⏎"  ·  btn-secondary height 38 "Cancel"
 │    note 11px
 ├ § "Exercise menu · ⋮ or right-click on the heading"
 │    menu width 266; bg surface; radius md; --shadow-lg; padding 6; items padding 9px 10px, 13px
 └ § "Undo toast · bottom-left, 5 s"
      toast width 400; padding 13px 14px; radius md; bg surface; box-shadow --shadow-md; gap 12
        ph-trash 16 danger + text 13px neutral-300 (flex:1) + action 13px accent
overlay: position absolute; inset 0; background rgba(10,11,13,0.45);
         display grid; place-items: center end; padding-right 60
   dialog width 440; bg surface; radius lg; padding 20; --shadow-lg; gap 12
     title row: ph-trash 17 danger + 18px title
     body 13px/1.55 neutral-400
     actions right-aligned gap 10:
        btn-secondary "Keep" + keycap esc
        outline-danger "Delete ⏎" (min-height 38; padding 0 16; border 1px danger; color danger)
```

**Strings (verbatim)**

- `W-08` · `Exercise · rename, menu, delete dialog, undo`
- `Rename in place`; input value `Back Squat`; `Save ⏎`; `Cancel`
- `Renaming affects this session only — history keeps the old name.`
- `Exercise menu · ⋮ or right-click on the heading`
- menu items: `Rename` `F2` · `Duplicate with sets` · `Move up / down` `⌥↑↓` · `Open history` · `Clear all sets` · `Delete exercise`
- `Undo toast · bottom-left, 5 s`
- toast: `“Back Squat” deleted · 3 sets` + `Undo ⌘Z`
- dialog title: `Delete “Back Squat”?`
- dialog body: `3 logged sets go with it — 12 × 40, 8 × 80, 8 × 85. Deleting is instant, with a 5-second undo.`
- dialog buttons: `Keep` (+ `esc`), `Delete ⏎`
- caption `All four editing surfaces in one frame — rename, menu, undo toast on the left, the delete dialog on the right. Dialogs are 440 px, esc keeps, Enter confirms the destructive action only when it is focused.`

**Keyboard shown:** `⏎` (save rename / confirm delete), `F2` (rename), `⌥↑↓` (move exercise), `⌘Z` (undo), `esc` (keep/cancel).
**Context:** exercise menu opens from a `⋮` affordance **or** right-click on the exercise heading. Menu icons: `ph-pencil-simple`, `ph-copy`, `ph-arrows-down-up`, `ph-chart-line-up`, `ph-eraser`, `ph-trash`.
**Undo timing:** 5 s, bottom-left.

---

## W-09 · Session finished · summary

**Purpose:** post-session page (not a modal) with the PR card and the per-exercise comparison table.

**Layout skeleton**

```
rail 206 — brand + "Today" active only
main flex:1; padding 30px 34px; gap 24; max-width 760
 ├ saved row: ph-fill ph-check-circle 20px --color-ok + 11px .12em uppercase label
 ├ title 34px (-0.03em) + subline 13px neutral-500
 ├ stat grid repeat(3,1fr) gap 12 — surface cards padding 16, 24px tabular values
 ├ PR card: radius lg; bg var(--color-ok-tint); padding 18; box-shadow inset 0 0 0 1px var(--color-ok-line)
 │     header: ph-trophy 16 + 11px uppercase, color --color-ok
 │     line 26px tabular --color-ok-text
 │     sub 12px --color-ok-text opacity .75
 ├ table.table — Exercise | Sets | Volume | vs last time  (deltas colored ok / danger)
 └ button row gap 10: btn-secondary "Edit session" · btn-secondary "Save as template" (ph-cards)
                      · btn-primary "Done ⏎"
```

**Strings (verbatim)**

- `W-09` · `Session finished · summary`
- `Session saved`
- `Leg day, done.`
- `Friday, 31 July · Smartass Obolon · synced`
- `41:07`/`Duration`, `11`/`Sets`, `3.4 t`/`Moved`
- `New record`
- `Back Squat · 90 kg × 8`
- `Previous best 85 kg × 8 · estimated 1RM up to 112 kg`
- headers `Exercise`, `Sets`, `Volume`, `vs last time`
- `Back Squat | 4 | 1 385 kg | +12%` · `Romanian Deadlift | 3 | 700 kg | −8%` · `Leg Press | 4 | 1 315 kg | +4%`
- `Edit session`, `Save as template`, `Done ⏎`
- caption `The summary is a page, not a modal — it holds the comparison table the phone can't fit.`

**Keyboard:** `⏎` on **Done**. **Hover/context:** table row hover from `.table` only.

---

## W-10 · History · two-pane, past session selected

**Purpose:** master–detail history; auto-closed session detail with an inline "add set" ghost row.

**Layout skeleton**

```
rail 206  (brand, Today active, Progress)
list pane width 290; flex none; padding 20px 14px; gap 6;
      box-shadow 1px 0 0 var(--color-divider); overflow hidden
  ├ filter field: flex gap 8; bg surface; radius md; padding 8px 10px; margin-bottom 8
  │        ph-magnifying-glass 14 neutral-500 + 13px neutral-600 label
  ├ month label 10px .1em uppercase neutral-600, padding 6px 8px
  ├ SELECTED item: padding 11px 12px; radius md; bg surface; box-shadow: inset 2px 0 0 var(--color-accent)
  ├ idle item:     padding 11px 12px; radius md
  ├ HOVER item:    background rgba(233,234,236,0.04)
  └ second month label (padding 14px 8px 6px)
detail flex 1; padding 26px 30px; gap 20
  ├ header row: kicker date-range + h 28px  |  actions:
  │      btn-secondary "Save as template" (ph-cards, min-height 36)
  │      outline-danger "Delete" (ph-trash, min-height 36, padding 0 14)
  ├ auto-close notice: padding 12px 14px; radius md; bg surface;
  │      box-shadow inset 3px 0 0 var(--color-accent); icon ph-clock-countdown accent
  ├ exercise block: heading (name 16px + right-aligned volume 11px) + table.table max-width 600
  │      cols Set(44) | Reps | Weight | Type | (80px)
  │      last row = prefilled ghost: every cell neutral-700, action btn-primary height 28 "Add"
  └ exercise block 2 (no thead)
```

**Strings (verbatim)**

- `W-10` · `History · two-pane, past session selected`
- `Filter sessions`
- `July` — `Mon 27 · Legs` / `14 sets · 3 420 kg` + tag `Auto-closed` (selected) · `Wed 29 · Push day` / `18 sets · 4 980 kg` · `Sat 25 · Pull day` / `21 sets · 5 640 kg` (hovered) · `Thu 23 · Push day` / `17 sets · 4 610 kg`
- `June` — `Mon 30 · Legs` / `12 sets · 2 980 kg`
- `Mon 27 July · 08:40 → 09:34` · `Legs`
- `Save as template`, `Delete`
- `Auto-closed after 8 hours — may be incomplete. Anything added here saves to 27 July.`
- `Front Squat` · `960 kg`; rows `1 | 10 | 40 | warm-up`, `2 | 8 | 60 | working`, ghost `3 | 8 | 60 | prefilled` + `Add`
- `Leg Press` · `2 460 kg`; rows `1 | 12 | 160 | working`, `2 | 10 | 170 | working`
- caption `Master–detail: the list keeps its scroll position while the detail changes. Selected row takes a brass edge, hover a 4% tint.`

**Keyboard:** none shown.
**Hover:** list item 4% tint (`Sat 25 · Pull day` shown hovered); selection is the 2px inset brass edge.

---

## W-11 · Progress · filled & not-enough-data

**Purpose:** charts with a range switcher, a hover tooltip, and an inline "needs more data" card beside real charts.

**Layout skeleton**

```
rail 206 (brand, Today idle, Progress active)
main gap 22
 ├ header row: h1 "Progress" 30px  +  .seg (13px) with 3 .seg-opt
 │      first .seg-opt selected: color accent; box-shadow inset 0 0 0 1px var(--color-accent)
 ├ grid 2fr 1fr, gap 22
 │   ├ Weekly volume: kicker + bar row height 170 gap 9 (same 10-bar ramp)
 │   │     bar 8 is position:relative and carries the TOOLTIP:
 │   │        position absolute; bottom calc(100% + 8px); left 50%; translateX(-50%);
 │   │        white-space nowrap; 11px; bg surface; --shadow-md; radius 6; padding 6px 9px; tabular
 │   │     + note line
 │   └ not-enough-data card: bg surface; radius lg; padding 18; centred column; gap 10
 │        ph-chart-line 22 neutral-700 · 15px title · 12px/1.55 body
 │        progress dots: 3 × 9px circles — accent, accent, neutral-800
 └ grid 1fr 1fr, gap 22
     ├ Estimated 1RM card (bg surface, radius lg, padding 16px 14px 10px)
     │    svg viewBox "0 0 300 90", height 90
     │      polyline accent 2px  points 6,76 42,70 78,62 114,64 150,50 186,44 222,36 258,26 294,14
     │      polyline neutral-700 1.5px dasharray "3 4"
     │              points 6,84 42,80 78,78 114,76 150,68 186,64 222,58 258,52 294,46
     │    legend: 10×2px swatches + labels
     └ Records table.table — Lift | Record | Est. 1RM | Moved
```

**Strings (verbatim)**

- `W-11` · `Progress · filled & not-enough-data`
- `Progress`; segments `12 weeks` (selected), `6 months`, `All time`
- `Weekly volume`; tooltip `W29 · 12.8 t · 3 sessions`
- `Hover a bar for the exact week — the tooltip is the only floating element on this page.`
- `Bench needs one more` / `Two sessions logged. A third unlocks its 1RM trend.`
- `Estimated 1RM`; legend `Squat 120 kg`, `Bench 93 kg`
- `Records`; headers `Lift`, `Record`, `Est. 1RM`, `Moved`
- `Back Squat | 110 × 3 | 120 kg | +5` · `Bench Press | 82.5 × 5 | 93 kg | +2.5` · `Deadlift | 140 × 2 | 148 kg |`
- caption `Desktop earns the range switcher and hover tooltips; the “not enough data” state sits inline beside real charts instead of replacing the page.`

**Keyboard:** none. **Hover:** bar tooltip (only floating element on the page); `.table` row hover.

---

## W-12 · Gyms · list, radius edit, location errors

**Purpose:** gym table with per-row edit/delete, the desktop-geolocation warning, radius slider and visit sparkline.

**Layout skeleton**

```
rail 206 (brand, Today idle, Gyms active)
main gap 18
 ├ h1 "Gyms" 30px
 ├ add row max-width 560 gap 10: input.input flex:1 min-height 40 + btn-primary (ph-crosshair) min-height 40
 ├ danger notice max-width 640: padding 11px 13px; radius md; bg danger-tint;
 │      box-shadow inset 0 0 0 1px var(--color-danger-line); ph-warning-circle 16 danger
 ├ table.table max-width 820 — Gym | Coordinates | Radius | Visits logged | (90px actions)
 │      row 1 trailing cell: ph-pencil-simple (margin-right 10) + ph-trash (danger)
 │      visits column colored: ok / danger / neutral-500
 └ two cards row (gap 22, max-width 820, margin-top 6)
     ├ radius card (flex 1; bg surface; radius lg; padding 16)
     │    label row (14px name+"· radius" / 18px tabular value)
     │    track: height 4; radius 2; bg neutral-800; margin-top 14; position relative
     │      fill width 32% bg accent · thumb 18px circle accent at left 32%,
     │      box-shadow 0 0 0 4px rgba(217,162,79,0.16)
     │    scale row 10px neutral-600 (min / max)
     └ visits card (flex 1) — kicker + 7-bar sparkline height 44, gap 5
          heights 40/70/100/55/85/30/20 %, colors accent-800/700/accent/800/700/neutral-800/neutral-800
```

**Strings (verbatim)**

- `W-12` · `Gyms · list, radius edit, location errors`
- `Gyms`; placeholder `Gym name`; `Use my location`
- `Desktop location is IP-based and came back at ±2 km — add the gym from your phone while standing in it, or type coordinates below.`
- headers `Gym`, `Coordinates`, `Radius`, `Visits logged`
- `Smartass Obolon` + tag `Inside` | `50.51234, 30.49871` | `150 m` | `11 / 12`
- `Sportlife Livoberezhna` | `50.45219, 30.60112` | `200 m` | `2 / 3`
- `Hotel gym · Lviv` | `49.83968, 24.02972` | `80 m` | `1 / 1`
- `Smartass Obolon · radius` · `150 m` · scale `30 m` … `2 000 m`
- `Visits · last 7 days`
- caption `Desktop is honest about its weak geolocation and hands the job to the phone — the one place the two clients differ in capability.`

**Keyboard:** none. **Hover:** row 1 shows pencil + trash in the trailing cell (same reveal pattern as W-04/W-06).

---

## W-13 · Tray popover · narrow window · shortcuts

**Purpose:** three desktop-only surfaces in one row — tray popover, 400px collapsed window, shortcut sheet.

### 13a — Tray popover (380 × 520, radius 14, `--shadow-lg`)

```
header  flex none; padding 14px 16px; gap 10; box-shadow 0 1px 0 var(--color-divider)
        8px accent dot + 13px label (flex 1) + 14px tabular clock
body    flex 1; padding 14px 16px; gap 12
  ├ exercise row: name 15px (flex 1) + "prev …" 11px neutral-600
  ├ input row gap 8:
  │    2 × field card flex 1 (bg surface; radius md; padding 8px 10px)
  │        label 10px .1em uppercase neutral-600 + value 20px tabular
  │    btn-primary width 78 "Log ⏎"
  ├ 1px divider
  ├ 3 logged rows: 16px index (11px neutral-600) + "8 × 85" flex 1 + optional .tag.tag-accent
  └ footer margin-top auto, gap 8: btn-secondary "Open window" + btn-secondary "Finish"
```

Strings: `In session · Leg day` · `24:18` · `Back Squat` · `prev 85 × 8` · `Reps` `8` · `Kg` `85` · `Log ⏎` · `3` `8 × 85` `record` · `2` `8 × 80` · `1` `12 × 40` `warm-up` · `Open window` · `Finish`.

### 13b — Narrow window (400 × 520)

```
chrome bar height 34 with label
top bar  padding 12px 14px; box-shadow 0 1px 0 divider
         ph-list 18 neutral-400 (hamburger) + "Today" 15px + 7px --color-ok dot
body     padding 16px 14px; gap 14
         24px headline · btn-primary min-height 48 "Start session" (ph-play)
         "Recent" kicker · 2 rows (40px date + name + duration), first with 1px bottom rule
         note pinned with margin-top auto
```

Strings: `400 px — rail collapses` · `Today` · `Nothing logged yet.` · `Start session` · `Recent` · `29 JUL` `Push day` `1:12` · `27 JUL` `Legs` `0:54` · `Under 720 px the rail becomes a hamburger, the right panel drops below the main column, and the layout matches the phone.`

### 13c — Shortcut sheet (290px, radius 12, `--shadow-sm`, padding 18, gap 12)

Row pattern: `flex; gap 10; font-size 13; color neutral-300` + label `flex:1` + keycap chip (11px, 1px divider border, radius 4, padding 1px 6px).

| Label (verbatim)    | Key             |
| ------------------- | --------------- |
| `Shortcuts · ?`     | (section title) |
| `New session`       | `⌘N`            |
| `Add exercise`      | `⌘K`            |
| `Log the set`       | `⏎`             |
| `Nudge weight ±2.5` | `⌥↑↓`           |
| `Mark warm-up`      | `⇧W`            |
| `Delete selected`   | `⌫`             |
| `Undo`              | `⌘Z`            |
| `Finish session`    | `⌘⏎`            |

Footnote: `Shown from “?” and from the ⌘K palette footer.`
Frame caption: `Three desktop-only surfaces: the tray popover for a set between sets, the collapsed window, and the shortcut sheet that the menus keep teaching.`

---

### Consolidated keyboard map (all frames)

| Shortcut       | Action                                                                                                                       | Shown in                           |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `↵` / `⏎`      | Submit sign-in; log the ghost set; save inline edit; confirm focused destructive action; Done on summary; Edit from set menu | W-01, W-06, W-07, W-08, W-09, W-13 |
| `⌘N`           | New / start session                                                                                                          | W-04, W-13                         |
| `⌘K`           | Add exercise (also the command palette whose footer shows the sheet)                                                         | W-06, W-13                         |
| `⌘⏎`           | Finish session                                                                                                               | W-06, W-13                         |
| `⌥↑ / ⌥↓`      | Nudge weight ± 2.5 kg; also Move exercise up/down (`⌥↑↓`)                                                                    | W-06, W-08, W-13                   |
| `⇧W`           | Mark as warm-up                                                                                                              | W-07, W-13                         |
| `⌫`            | Delete set / delete selected                                                                                                 | W-07, W-13                         |
| `⌘D`           | Duplicate set                                                                                                                | W-07                               |
| `⌘Z`           | Undo (paired with the 5 s undo toast)                                                                                        | W-08, W-13                         |
| `F2`           | Rename exercise                                                                                                              | W-08                               |
| `esc`          | Cancel inline edit; Keep in delete dialog                                                                                    | W-07, W-08                         |
| `Tab`          | reps → weight → Log                                                                                                          | W-06                               |
| `Double-click` | Edit row in place                                                                                                            | W-07                               |
| `?`            | Open shortcut sheet                                                                                                          | W-13                               |

### Consolidated hover / context-menu behaviours

- **Rail item hover:** `background: rgba(233,234,236,0.05)`, color → `neutral-300` (W-04).
- **Table row hover:** `rgba(233,234,236,0.04)` tint (DS: `text 4%`), reveals trailing-cell actions — `⋮` on history rows (W-04), pencil + trash on set rows (W-06) and gym rows (W-12).
- **History list hover:** `rgba(233,234,236,0.04)`; selection = `inset 2px 0 0 var(--color-accent)` (W-10).
- **Bar-chart hover:** absolutely positioned tooltip above the bar (W-11) — described as the only floating element on that page.
- **Right-click on a set row** → 250px set context menu (W-07).
- **Right-click on an exercise heading, or the `⋮` button** → 266px exercise menu (W-08).
- Every menu item displays its shortcut right-aligned.

---

# PART 2 — The Graphite clickable prototype

The prototype renders **two devices side by side in one canvas**, both driven by a single state object:

- **Phone · PWA** — `390 × 844`, radius 38, `--shadow-lg`, `position:relative` (so toast/dialog can be absolutely positioned inside it). Fixed status bar: `9:41` + `ph-fill ph-cell-signal-high` / `ph-wifi-high` / `ph-battery-high`.
- **Desktop / tray window** — `1180 × 760`, radius 14; caption `Desktop / tray window · tabs become a rail, session docks right`.

Board header strings: `My Fit` / `Graphite & silver · brass accent`; H1 `The merged build`; deck `Tabs from A, the in-place session table from C, and the week strip, start block and recent list from B — on a graphite ground with silver type. The accent is a brass amber: warm against a cool neutral, ~4:1 on the ground, and it never floods a surface — only lines, marks and numbers.`

## 2.1 State model

```js
state = {
  view: 'today', // screen router
  live: false, // session running
  reminder: true, // unlogged-visit card visible
  elapsed: 0, // session seconds
  rest: 0, // rest seconds remaining
  offline: false,
  empty: false, // Today empty-state toggle
  toast: null,
  toastKind: 'ok',
  confirm: false, // delete dialog
  gymAdds: 0,
  gymError: false,
  lastVolume: '4.9 t',
  exercises: [
    {
      id: 'e1',
      name: 'Back Squat',
      last: '85 × 8',
      reps: 8,
      weight: 85,
      sets: [
        { r: 12, w: 40, warm: true },
        { r: 8, w: 80 },
        { r: 8, w: 85 },
      ],
    },
    {
      id: 'e2',
      name: 'Romanian Deadlift',
      last: '70 × 10',
      reps: 10,
      weight: 72.5,
      sets: [{ r: 10, w: 70 }],
    },
  ],
};
```

**Ticker:** `componentDidMount` starts `setInterval(…, 1000)`:

```js
elapsed: s.live ? s.elapsed + 1 : s.elapsed,
rest:    s.rest > 0 ? s.rest - 1 : 0
```

cleared in `componentWillUnmount`. Clock formatter: `mmss(t) → Math.floor(t/60) + ':' + String(t%60).padStart(2,'0')` — i.e. `0:07`, `24:18`, no hour rollover, minutes not zero-padded.

## 2.2 Derived values (`renderVals`)

| Binding                                                                                                 | Rule                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isLogin/isRegister/isApps/isToday/isWorkout/isProgress/isGyms/isSummary/isPast/isTemplates/isExercise` | `view === '<name>'`                                                                                                                                      |
| `showTabs`                                                                                              | true unless `view ∈ {login, register, workout, summary, past, exercise}`                                                                                 |
| `isEmpty` / `notEmpty`                                                                                  | `empty` / `!empty`                                                                                                                                       |
| `syncDot`                                                                                               | `offline ? var(--color-danger) : var(--color-ok)`                                                                                                        |
| `syncLabel`                                                                                             | `offline ? 'Offline · 2 queued' : 'Synced'`                                                                                                              |
| `heroLine`                                                                                              | `live ? 'Mid-session.' : 'Nothing logged yet.'`                                                                                                          |
| `deskTitle`                                                                                             | `progress → 'Progress'`, `gyms → 'Gyms'`, else `'Today'`                                                                                                 |
| `sessionLive` / `sessionIdle`                                                                           | `live` / `!live`                                                                                                                                         |
| `hasReminder`                                                                                           | `reminder && !live`                                                                                                                                      |
| `clock`                                                                                                 | `mmss(elapsed)`                                                                                                                                          |
| `restClock` / `resting`                                                                                 | `mmss(rest)` / `rest > 0`                                                                                                                                |
| `setCount`                                                                                              | Σ `e.sets.length`                                                                                                                                        |
| `exCount`                                                                                               | `exercises.length`                                                                                                                                       |
| `volume`                                                                                                | `(Σ r*w / 1000).toFixed(1) + ' t'`                                                                                                                       |
| `colToday/colProgress/colGyms/colApps`                                                                  | active `var(--color-accent)` else `var(--color-neutral-600)`                                                                                             |
| `bgToday/bgProgress/bgGyms`                                                                             | active `var(--color-accent-900)` else `transparent` (desktop rail)                                                                                       |
| `toastFg/Bg/Icon`                                                                                       | ok → `--color-ok-text` / `--color-ok-tint` / `ph-bold ph-check-circle`; else `--color-danger-text` / `--color-danger-tint` / `ph-bold ph-warning-circle` |
| `exercises[]` per row                                                                                   | `nextN = sets.length + 1`; `ghostReps = e.reps`; `ghostWeight = e.weight`                                                                                |
| set row `kind`                                                                                          | `warm ? 'warm-up' : (w >= 85 && !warm ? 'record' : 'working')`                                                                                           |
| set row `kindFg`                                                                                        | `record → var(--color-ok)`, else `var(--color-neutral-600)`                                                                                              |
| set row `fg`                                                                                            | `warm → var(--color-neutral-500)`, else `var(--color-text)`                                                                                              |

**PR rule (the whole PR system in this prototype):** a non-warm-up set with **weight ≥ 85** is a record. It affects both the row's type label/colour and the record toast.

## 2.3 Every interactive behaviour

### Navigation handlers

`go(v) = () => setState({view:v})` produces: `goLogin`, `goApps`, `goToday`, `goProgress`, `goGyms`, `goRegister`, `goTemplates`, `goPast`, `goExercise`.

### Tab switching

Phone tab bar (`showTabs`): 4-column grid, `padding 8px 12px 22px`, `background var(--color-bg)`, `box-shadow: 0 -1px 0 var(--color-divider)`. Each tab is a `button.tapbtn` with a 20px Phosphor icon over a 10px label; colour bound to `colToday/colProgress/colGyms/colApps`. Labels: `Today` (`ph-house`), `Progress` (`ph-chart-line-up`), `Gyms` (`ph-map-pin`), `Apps` (`ph-squares-four`). **The bar is removed entirely on login, register, workout, summary, past and exercise** — session and detail screens are full-bleed.

Desktop rail: the same three destinations as `button.tapbtn`s with `background:{{bgX}}; color:{{colX}}`, plus a static `Services` group (`Training` → `goToday`; `Nutrition` and `AI body scan` are non-interactive at `opacity .5`) and a `Synced` footer chip. **The rail does not change the desktop body layout** — only `deskTitle` changes; the desktop always shows the Today dashboard plus the right dock.

### Session flow

| Handler           | Effect                                                                                                                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `startWorkout`    | `{ view:'workout', live:true, elapsed:0, reminder:false, empty:false }` — **resets the clock**. Bound to: Start empty session, Repeat Push day, all three template cards, "Save current session as template", and the reminder's "Log it".                         |
| `openWorkout`     | `{ view:'workout', live:true, reminder:false }` — **keeps the running clock**. Bound to the Today "Session in progress" card.                                                                                                                                      |
| `addSet(ev)`      | reads `ev.currentTarget.dataset.id`; if `ex.weight >= 85` fires the PR toast; then `{ live:true, rest:90, exercises: … sets.concat([{ r:e.reps, w:e.weight }]) }`. So logging **starts the session if it wasn't live** and **always (re)starts a 90-second rest**. |
| `bump(ev)`        | reads `dataset.id`, `dataset.f` (`reps`\|`weight`), `dataset.d` (`1`\|`2.5`); `e[f] = Math.max(0, e[f] + d)` — **increment-only, clamped at 0, no decrement control exists**.                                                                                      |
| `addExercise`     | appends `{ id:'e'+(len+1), name:'Bench Press', last:'80 × 5', reps:5, weight:80, sets:[] }`. (Note: id collides if an exercise was ever removed — nothing removes exercises in this prototype.)                                                                    |
| `skipRest`        | `{ rest: 0 }`                                                                                                                                                                                                                                                      |
| `finishWorkout`   | `{ view:'summary', live:false, rest:0, lastVolume: (Σ r*w/1000).toFixed(1)+' t' }`                                                                                                                                                                                 |
| `dismissReminder` | `{ reminder:false }`                                                                                                                                                                                                                                               |
| `toggleOffline`   | flips `offline` (bound to the sync chip on Today — the chip is a button)                                                                                                                                                                                           |
| `toggleEmpty`     | flips `empty` (bound to the tiny `empty state` link and to `Show filled state`)                                                                                                                                                                                    |
| `askDelete`       | `{ confirm:true }` — trash icon in the past-workout header and the `Delete workout` link                                                                                                                                                                           |
| `closeConfirm`    | `{ confirm:false }`                                                                                                                                                                                                                                                |
| `confirmDelete`   | `{ confirm:false, view:'today' }` + `toast('Workout deleted', 'err')`                                                                                                                                                                                              |
| `addGym`          | `n = gymAdds+1; bad = n % 2 === 0` → `{ gymAdds:n, gymError:bad }` + toast. **Every second attempt fails**, and `gymError` also toggles the inline error block.                                                                                                    |

### Toasts

```js
toast(text, kind) {
  clearTimeout(this.tt);
  this.setState({ toast: text, toastKind: kind || 'ok' });
  this.tt = setTimeout(() => this.setState({ toast: null }), 3200);
}
```

Single-slot, **3200 ms**, re-firing replaces the current toast. Three toasts exist:

| Trigger                          | Text                                                                                             | Kind |
| -------------------------------- | ------------------------------------------------------------------------------------------------ | ---- |
| `addSet` with `weight >= 85`     | `New record · ` + name + ` ` + weight + `kg ×` + reps → e.g. `New record · Back Squat 85 kg × 8` | ok   |
| `addGym` success (odd attempts)  | `Gym added`                                                                                      | ok   |
| `addGym` failure (even attempts) | `GPS accuracy ±240 m — try again inside`                                                         | err  |
| `confirmDelete`                  | `Workout deleted`                                                                                | err  |

### Rest timer

Only surface is the phone session bar (`resting`). Duration is fixed at **90 s**, counts down 1/s to 0, and is reset to 90 on every `Log`. `Skip` zeroes it; `finishWorkout` zeroes it. There is **no rest bar in the desktop dock**.

### Undo snackbar

**Not implemented in the prototype.** The delete path is dialog-confirmed and irreversible (`This removes it from every device on the next sync and cannot be undone.`), followed by a plain error-tinted toast. The undo snackbar exists only as a static spec on the web board — W-08: `“Back Squat” deleted · 3 sets` / `Undo ⌘Z`, bottom-left, 5 s. If you need parity, implement it from W-08's markup.

### Auto-close (8 h) representation

Purely presentational — three places:

1. Today → Recent list: `Legs` + `<span class="tag tag-neutral">Auto-closed</span>`
2. Desktop Recent sessions table: same tag in the Session cell
3. `past` screen: the accent-edged notice `Auto-closed after 8 hours — it may be incomplete. Anything you add here is saved to the original date.` (web board W-10 uses the shorter `Auto-closed after 8 hours — may be incomplete. Anything added here saves to 27 July.`)

No timer implements the 8 h close.

## 2.4 Exact DOM / class patterns

**Ghost row (phone session, per exercise card)**

```html
<div
  style="display:grid;grid-template-columns:18px 1fr 1fr 62px;gap:8px;align-items:center;
            padding:9px 0 2px;font-size:16px;font-variant-numeric:tabular-nums"
>
  <span style="font-size:11px;color:var(--color-neutral-700)">{{ ex.nextN }}</span>
  <button
    class="tapbtn"
    data-id="{{ ex.id }}"
    data-f="reps"
    data-d="1"
    onClick="{{ bump }}"
    style="text-align:left;background:none;border:none;border-bottom:1px dashed var(--color-neutral-700);
           color:var(--color-neutral-400);font-size:16px;padding:2px 0;font-variant-numeric:tabular-nums"
  >
    {{ ex.ghostReps }}
  </button>
  <button
    class="tapbtn"
    data-id="{{ ex.id }}"
    data-f="weight"
    data-d="2.5"
    onClick="{{ bump }}"
    style="…identical…"
  >
    {{ ex.ghostWeight }}
  </button>
  <button
    class="btn btn-primary tapbtn"
    data-id="{{ ex.id }}"
    onClick="{{ addSet }}"
    style="height:34px;padding:0;font-size:13px"
  >
    Log
  </button>
</div>
<div style="font-size:10px;color:var(--color-neutral-600);margin-top:7px">
  Prefilled from last time · tap a number to nudge it
</div>
```

Desktop dock variant: grid `16px 1fr 1fr 52px`, font 14px, padding `1px 0`, Log button `height:28px;font-size:12px`, and **no hint line**.

**Set row (logged)**

```html
<div
  class="row-in"
  style="display:grid;grid-template-columns:18px 1fr 1fr 62px;gap:8px;align-items:center;
     padding:7px 0;font-size:16px;font-variant-numeric:tabular-nums;box-shadow:0 1px 0 var(--color-divider)"
>
  <span style="font-size:11px;color:var(--color-neutral-600)">{{ s.n }}</span>
  <span style="color:{{ s.fg }}">{{ s.reps }}</span>
  <span style="color:{{ s.fg }}">{{ s.weight }}</span>
  <span style="font-size:10px;color:{{ s.kindFg }};text-align:right">{{ s.kind }}</span>
</div>
```

Column header strip above the rows: same grid, `font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--color-neutral-600);padding-bottom:4px` with cells `#`, `Reps`, `Kg`, `` (empty).

**PR badge** — two forms:

1. In-row: the 4th cell text `record` coloured `var(--color-ok)` (`kindFg`).
2. Summary card:

```html
<div
  style="border-radius:var(--radius-lg);background:var(--color-ok-tint);padding:16px;
            box-shadow:inset 0 0 0 1px var(--color-ok-line)"
>
  <div style="display:flex;align-items:center;gap:8px;color:var(--color-ok)">
    <i class="ph-bold ph-trophy" style="font-size:16px"></i>
    <span style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase">New record</span>
  </div>
  <div
    style="font-size:24px;letter-spacing:-0.02em;margin-top:9px;color:var(--color-ok-text);font-variant-numeric:tabular-nums"
  >
    Back Squat · 85 kg × 8
  </div>
  <div style="font-size:12px;color:var(--color-ok-text);opacity:0.75;margin-top:5px">
    Previous best 80 kg × 8 · estimated 1RM up to 106 kg
  </div>
</div>
```

Elsewhere `.tag.tag-accent` carries `+5` / `+2.5` deltas and `Inside` / `Used 6×`.

**Rest timer bar**

```html
<div
  class="fade-in"
  style="flex:none;margin:0 18px 14px;background:var(--color-accent-900);
     border-radius:var(--radius-md);padding:11px 14px;display:flex;align-items:center;gap:12px"
>
  <i class="ph-bold ph-timer" style="font-size:17px;color:var(--color-accent-300)"></i>
  <span style="flex:1;font-size:13px;color:var(--color-accent-200)">Rest</span>
  <span style="font-size:18px;font-variant-numeric:tabular-nums;color:var(--color-accent-100)"
    >{{ restClock }}</span
  >
  <button class="btn btn-ghost tapbtn" onClick="{{ skipRest }}" style="font-size:12px">Skip</button>
</div>
```

Sits **below** the scrolling exercise list, above the (hidden) tab bar. No progress fill — number only.

**Toast**

```html
<div
  class="fade-in"
  style="position:absolute;left:18px;right:18px;bottom:96px;z-index:8;
     display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:var(--radius-md);
     background:{{ toastBg }};box-shadow:var(--shadow-md);color:{{ toastFg }}"
>
  <i class="{{ toastIcon }}" style="font-size:17px"></i>
  <span style="flex:1;font-size:13px">{{ toastText }}</span>
</div>
```

Bottom-anchored at 96px (clears the tab bar), full-bleed minus 18px gutters, no action button.

**Dialog**

```html
<div
  class="fade-in"
  style="position:absolute;inset:0;z-index:9;background:rgba(10,11,13,0.66);
     display:grid;place-items:center;padding:22px"
>
  <div
    style="width:100%;background:var(--color-surface);border-radius:var(--radius-lg);padding:18px;
       box-shadow:var(--shadow-lg);display:flex;flex-direction:column;gap:var(--space-3)"
  >
    <div style="display:flex;align-items:center;gap:9px;color:var(--color-danger)">
      <i class="ph-bold ph-trash" style="font-size:17px"></i>
      <span style="font-size:17px;color:var(--color-text)">Delete this workout?</span>
    </div>
    <div style="font-size:13px;line-height:1.55;color:var(--color-neutral-400)">
      Legs · 27 July, 14 sets. This removes it from every device on the next sync and cannot be
      undone.
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:var(--space-2)">
      <button
        class="btn btn-secondary tapbtn"
        onClick="{{ closeConfirm }}"
        style="min-height:40px;font-size:14px"
      >
        Keep
      </button>
      <button
        class="tapbtn"
        onClick="{{ confirmDelete }}"
        style="min-height:40px;padding:0 16px;
        border-radius:var(--radius-md);background:transparent;border:1px solid var(--color-danger);
        color:var(--color-danger);font-size:14px"
      >
        Delete
      </button>
    </div>
  </div>
</div>
```

**Exact dialog copy — title `Delete this workout?`, body `Legs · 27 July, 14 sets. This removes it from every device on the next sync and cannot be undone.`, buttons `Keep` / `Delete`.** (The web board's W-08 dialog is the other one: `Delete “Back Squat”?` / `3 logged sets go with it — 12 × 40, 8 × 80, 8 × 85. Deleting is instant, with a 5-second undo.` / `Keep` + `esc` / `Delete ⏎`.)

Z-order inside the phone: toast `z-index 8`, dialog `z-index 9`, both `position:absolute` within the 390×844 frame.

**Other recurring patterns**

- Left-edge accent notice: `box-shadow: inset 3px 0 0 var(--color-accent)` on a `--color-surface` card (reminder, auto-close notice). Danger version: `inset 3px 0 0 var(--color-danger)` on `--color-danger-tint`.
- Boxed error: `background: var(--color-danger-tint); box-shadow: inset 0 0 0 1px var(--color-danger-line)`.
- Success note: `background: var(--color-ok-tint)` (+ `inset 0 0 0 1px var(--color-ok-line)` on cards).
- Exercise card: `border-radius: var(--radius-md); background: var(--color-surface); padding: 13px 14px`.

## 2.5 Screen list and full copy

### `login`

`My Fit` (32px) · `Everything you lift, in one place.` · placeholders `Email or username`, `Password` · `Sign in` → `goToday` · `New here? Create an account` → `goRegister`. Tab bar hidden.

### `register`

`Create your account` · ok-tinted note (`ph-shield-check`): `Your log is private to your account. Free while My Fit is in beta.` · placeholders `Username`, `Email`, `Password (min. 6 characters)` · persistent inline error `Password is too short — 6 characters minimum` · `Create account` → `goToday` · `Back to sign in` → `goLogin`. Tab bar hidden.

### `apps`

`Services` · `Sign out` → `goLogin` · Training card (bordered `--color-accent-800`, 44px icon tile `accent-900`/`accent-300`): `Training` / `Workouts, sets, weights, gyms` / `.tag.tag-accent` `3 this week` → `goToday` · `Nutrition` / `Soon` (opacity .4) · `AI body scan` / `Soon` (opacity .4) · footer `Synced` with ok dot.

### `today`

- Header: `Friday, 31 July` kicker + `{{ heroLine }}` (`Nothing logged yet.` / `Mid-session.`) + sync chip button `{{ syncLabel }}` → `toggleOffline`.
- Offline banner (`offline`): `No connection. Two changes are queued — they'll sync on their own.`
- Week strip: 7 equal cells (`M T W T F S S`), each `flex:1; text-align:center; padding:9px 0; radius md; bg surface`, 10px letter + 6px dot below (`margin:7px auto 0`). Dots: M/W/S accent, others `neutral-800`; **F** letter is `neutral-400` and its dot carries `box-shadow: 0 0 0 3px var(--color-neutral-900)` (today ring).
- Reminder card (`hasReminder`): `1h 20m at **Smartass Obolon** on 12 Jul with nothing logged.` + `Log it` → `startWorkout` · `Dismiss` → `dismissReminder`.
- Start block (`sessionIdle`): `Start empty session` (min-height 62, radius lg) → `startWorkout`; then two half cards — `Repeat Push day` / `Wed · 5 exercises` → `startWorkout`, and `Templates` / `4 saved` → `goTemplates`.
- Live card (`sessionLive`): bordered accent, `bg accent-900`, breathing dot — `Session in progress` / `{{ clock }} · {{ setCount }} sets · {{ volume }}` → `openWorkout`.
- Recent (`notEmpty`): kicker `Recent` + a tiny `empty state` link → `toggleEmpty`; three rows → `goPast`: `29 JUL` `Push day` `18 sets · 4 980 kg · 1:12` / `27 JUL` `Legs` + tag `Auto-closed` `14 sets · 3 420 kg · 0:54` / `25 JUL` `Pull day` `21 sets · 5 640 kg · 1:03`.
- Empty (`isEmpty`): `Nothing logged yet` · `Your first session takes about four taps. Sets you log offline are queued and sync as soon as you are back online.` · `Show filled state` → `toggleEmpty`.

### `workout`

Back caret → `goToday` · kicker `In session · Smartass Obolon` · `{{ clock }}` 22px · `Finish` → `finishWorkout` · stat row `{{setCount}}`/`sets`, `{{volume}}`/`moved`, `{{exCount}}`/`exercises` · `sc-for exercises` cards (name button → `goExercise`, `prev {{ex.last}}`, header strip, logged rows, ghost row, `Prefilled from last time · tap a number to nudge it`) · `Add exercise` → `addExercise` · rest bar when `resting`. Tab bar hidden.

### `progress`

`14.2` `t` + `Volume this week` + `.tag.tag-accent` `+18%` · 10-bar chart (same ramp) · `Estimated 1RM` card with two polylines (accent solid `6,84 42,78 78,70 114,72 150,58 186,50 222,42 258,30 294,16`; neutral-700 dashed `6,92 42,88 78,86 114,84 150,76 186,72 222,66 258,60 294,52`; accent dot at `294,16`) + legend `Squat 120 kg` / `Bench 93 kg` · `Records`: `Back Squat 110 kg +5`, `Bench Press 82.5 kg +2.5`, `Deadlift 140 kg 6 wks`.

### `gyms`

`Gyms` · `Add a gym while standing in it. Visits are matched against your log — an unlogged hour shows up on Today.` · `Gym name` input + `I'm here` (`ph-crosshair`) → `addGym` · error block (`gymError`): `Location came back at ±240 m — too coarse to pin a gym. Step inside and try again, or widen the radius afterwards.` · gym card `Smartass Obolon` + tag `Inside`, `50.51234, 30.49871` / `150 m`, 7-bar sparkline, `Visits · 11 of 12 logged` · second card `Sportlife Livoberezhna`, `50.45219, 30.60112` / `200 m`.

### `summary`

`Session saved` (ok, `ph-fill ph-check-circle`) · `Leg day, done.` · `Friday, 31 July · Smartass Obolon` · three stat cards `{{clock}}`/`Duration`, `{{setCount}}`/`Sets`, `{{lastVolume}}`/`Moved` · PR card `New record` / `Back Squat · 85 kg × 8` / `Previous best 80 kg × 8 · estimated 1RM up to 106 kg` · `Compared to last leg day`: `Back Squat 1 385 kg +12%` (ok), `Romanian Deadlift 700 kg −8%` (danger), `Session volume {{lastVolume}} +4%` (ok) · footer `Edit session` → `goPast` and `Done` → `goToday`. Tab bar hidden.

### `past`

Back caret → `goToday` · `Mon 27 July · 08:40 → 09:34` / `Legs` · trash icon → `askDelete` · auto-close notice `Auto-closed after 8 hours — it may be incomplete. Anything you add here is saved to the original date.` · `Front Squat` `960 kg moved` rows `1 | 10 | 40 | warm-up`, `2 | 8 | 60 | working`, `3 | 8 | 65 | working` · `Leg Press` `2 460 kg moved` rows `1 | 12 | 160 | working`, `2 | 10 | 170 | working` · `Add exercise to this session` → `goExercise` · `Delete workout` → `askDelete`. Tab bar hidden. **Note: these rows are static markup, not `sc-for` — the past screen is not editable in the prototype.**

### `templates`

Back caret → `goToday` · `Templates` · `A template is just a past session you kept. Loading one prefills every exercise with the weights you used last time.` · three cards, all → `startWorkout`:

- `Push day` + `.tag.tag-accent` `Used 6×` / `Bench Press · Incline DB · Dips · Lateral raise · Triceps pushdown` / `Load · 18 sets prefilled`
- `Legs · heavy` + `.tag.tag-neutral` `Used 4×` / `Back Squat · Romanian Deadlift · Leg Press · Calf raise` / `Load · 14 sets prefilled`
- `Pull day` + `.tag.tag-neutral` `Used 5×` / `Pull-up · Barbell row · Face pull · Curl` / `Load · 16 sets prefilled`
  · `Save current session as template` → `startWorkout`. Tab bar visible (`templates` is not in the hide list).

### `exercise`

Back caret → `openWorkout` · `Back Squat` / `14 sessions · since March` · stats `110`/`Record kg` (ok-coloured), `120`/`Est. 1RM`, `85`/`Last top set` · `Top set · 12 weeks` chart (accent polyline `6,80 34,76 62,68 90,70 118,58 146,52 174,46 202,36 230,30 258,22 286,12`, ok dot at `286,12`) with axis labels `60 kg` … `110 kg · record` · `Last sessions` table (`Date | Top set | Volume`): `29 Jul | 85 × 8 | 1 385 kg`, `25 Jul | 82.5 × 8 | 1 240 kg`, `21 Jul | 80 × 8 | 1 180 kg`, `17 Jul | 80 × 6 | 1 060 kg`. Tab bar hidden.

### Desktop pane (always rendered, not routed)

Rail (`My Fit`, `Today`/`Progress`/`Gyms`, divider, `Services`: `Training`, `Nutrition`, `AI body scan`, footer `Synced`) · main column: `Friday, 31 July` + `{{ deskTitle }}`, `Start session` button shown only when `sessionIdle` → `startWorkout`; 4 stat cards (`3`/`Sessions`, `14.2 t`/`Volume`, `2`/`New PRs`, `21 d`/`Streak`); `Weekly volume` + `+18% vs June` + 10 bars; `Recent sessions` table (`Date|Session|Sets|Volume|Duration`, same four rows as W-04 incl. the `Auto-closed` tag) · right dock 352px:

- `sessionLive`: breathing dot + `In session` + `{{clock}}`; `{{setCount}}`/`sets`, `{{volume}}`/`moved`; scrolling exercise cards with the compact ghost row; `Finish session` → `finishWorkout`.
- `sessionIdle`: `Templates` (`Push day` / `Bench · Incline DB · Dips · Lateral raise · Triceps` / `Load template`; `Legs · heavy` / `Squat · RDL · Leg press · Calf raise` / `Load template`, both → `startWorkout`), divider, `Records` (`Back Squat 110 kg +5`, `Bench Press 82.5 kg +2.5`, `Deadlift 140 kg`).

## 2.6 Navigation map

```
login ──Sign in──────────────► today
      └─Create an account───► register ──Create account──► today
                                        └─Back to sign in─► login

apps ──Sign out───────────────► login
     └─Training card─────────► today

today ─sync chip─────────────► (toggle offline, stays)
      ─empty state / Show filled state► (toggle empty, stays)
      ─Log it (reminder)─────► workout   [live, elapsed reset]
      ─Dismiss───────────────► (reminder off)
      ─Start empty session───► workout   [live, elapsed reset]
      ─Repeat Push day───────► workout   [live, elapsed reset]
      ─Templates─────────────► templates
      ─Session in progress───► workout   [live, clock kept]
      ─Recent row ×3─────────► past

workout ─back caret──────────► today   (session keeps running: live stays true)
        ─exercise name───────► exercise
        ─Log (per exercise)──► stays; +1 set, rest=90, live=true, maybe PR toast
        ─reps / kg ghost─────► stays; bump +1 / +2.5
        ─Add exercise────────► stays; appends Bench Press
        ─Skip (rest bar)─────► stays; rest=0
        ─Finish──────────────► summary  [live=false, rest=0, lastVolume computed]

summary ─Edit session────────► past
        ─Done────────────────► today

past ──back caret────────────► today
     ──Add exercise to this session► exercise
     ──trash / Delete workout─► [dialog] ─Keep──► past
                                        └Delete─► today + toast "Workout deleted"

templates ─back caret────────► today
          ─any template card─► workout  [live, elapsed reset]
          ─Save current…─────► workout

exercise ─back caret─────────► workout (openWorkout: live=true, clock kept)

gyms ──I'm here──────────────► stays; odd → toast "Gym added";
                                      even → toast "GPS accuracy ±240 m — try again inside" + inline error

tab bar (today/progress/gyms/apps) and desktop rail ──► today | progress | gyms | apps
```

## 2.7 Gaps to close when reimplementing

1. **No undo snackbar** in the prototype — port W-08's 5-second `Undo ⌘Z` toast if undo is required.
2. **No keyboard handling at all** in the prototype — every shortcut in W-06/W-07/W-08/W-13 is unimplemented (`⌘N`, `⌘K`, `⏎`, `⌥↑↓`, `⇧W`, `⌫`, `⌘Z`, `⌘⏎`, `F2`, `esc`, `?`).
3. **No hover reveals, context menus, inline row editing, or set deletion** in the prototype — those exist only as static web-board markup.
4. **Ghost values are increment-only** (`Math.max(0, …)` never reached since deltas are positive); a real build needs decrement/typed input.
5. **PR detection is a hard-coded `weight >= 85`**, not compared against history.
6. **Rest duration (90 s) and toast duration (3200 ms) are constants**; the web board's undo is 5 s. Auto-close after 8 h is text only.
7. **The desktop pane ignores `view`** except for its title string — the rail is decorative navigation.
