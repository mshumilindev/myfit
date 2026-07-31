I've read the full file (all 1416 lines) plus its two imported components and the design-system stylesheet. Full inventory below.

---

# My Fit — "All States" mobile inventory (S-01 … S-50)

## 0. Global facts you need before any frame

**Language of every string in this document is English.** There is no Ukrainian/Cyrillic copy anywhere in `My Fit - All States.dc.html` (no "Сьогодні"); the Today tab label is literally `Today`. All strings below are verbatim, including the typographic characters actually used: curly quotes `“ ”`, apostrophe `'` (U+2019 in `I'm here`, `don't`, `they'll`, `you'd`, `isn't`, `it's`), middle dot `·`, multiplication sign `×`, en dash `–`, em dash `—`, minus `−`, ellipsis `…`, and **thin-space thousands separators** (`4 980 kg`, `1 385 kg`, `2 000 m`).

**Important structural note for reimplementation:** the design file does _not_ use semantic component classes like `.screen`/`.topbar`/`.card.session`. Almost everything is inline-styled `<div>`s. The only real CSS classes in play are `.btn`, `.btn-primary`, `.btn-secondary`, `.input`, `.tag`, `.tag-accent`, `.tag-neutral`, `.table`, `.sk`, `.sp`, plus Phosphor `ph-*` icon classes. The trees below therefore name elements by role and give the exact inline styling that defines them.

### Phone frame (identical for S-01 … S-48)

```
.phone  (390 × 844, background var(--color-bg) #16171a, border-radius 34px,
         box-shadow var(--shadow-md), overflow hidden, display flex column;
         + position:relative on any frame with an overlay/sheet/snackbar)
  ├── <dc-import MFStatus>        (100% × 34px — iOS status bar)
  ├── <content>  flex:1, overflow hidden          ← varies per frame
  └── <dc-import MFTabs active="…"> (100% × 78px — only on tabbed frames)
```

### `MFStatus` (statusbar component, `MFStatus.dc.html`)

`display:flex; justify-content:space-between; padding:14px 26px 4px; font-size:12px; font-weight:500; color:#d0d3d6; flex:none`

- Left text: **`9:41`**
- Right: `<span gap:6px>` with `ph-fill ph-cell-signal-high`, `ph-fill ph-wifi-high`, `ph-fill ph-battery-high`

### `MFTabs` (bottom tab bar, `MFTabs.dc.html`)

`display:grid; grid-template-columns:repeat(4,1fr); padding:8px 12px 22px; background:#16171a; box-shadow:0 -1px 0 rgba(233,234,236,0.14); flex:none`
Each item: `flex column; align-items:center; gap:4px; padding:6px 0`, icon 20px + label 10px.
Active color `#d9a24f`, inactive `#71767b` (prop `active` ∈ `today | progress | gyms | apps`).

| Slot | Icon                       | Label      |
| ---- | -------------------------- | ---------- |
| 1    | `ph-bold ph-house`         | `Today`    |
| 2    | `ph-bold ph-chart-line-up` | `Progress` |
| 3    | `ph-bold ph-map-pin`       | `Gyms`     |
| 4    | `ph-bold ph-squares-four`  | `Apps`     |

### Tokens overridden locally by this document's `<style>` (graphite + brass)

```
--color-bg:#16171a  --color-surface:#1f2125  --color-text:#e9eaec
--color-divider:rgba(233,234,236,0.14)   --color-accent:#d9a24f
accent 100→900: #fbf3e6 #f6e6cb #eed3a5 #e4bb76 #d9a24f #b3833d #8a642e #5b4420 #342713
neutral 100→900: #f5f6f7 #e6e8ea #d0d3d6 #b0b4b8 #90959a #71767b #55595e #3b3f43 #262a2d
--shadow-sm: 0 0 0 1px #3b3f43
--shadow-md: 0 0 0 1px #55595e, 0 6px 18px rgba(0,0,0,.6)
--shadow-lg: 0 0 0 1px #6b7075, 0 18px 44px rgba(0,0,0,.7)
--color-ok:#4cbe8c  --color-ok-text:#b7e8cf  --color-ok-tint:#16291f  --color-ok-line:#2f6f52
--color-danger:#e2564f --color-danger-text:#f3c2bf --color-danger-tint:#2c1614 --color-danger-line:#7d302b
```

Inherited from `_ds/nocturne…/styles.css` (not overridden): `--space-1:2.8px --space-2:5.6px --space-3:8.4px --space-4:11.2px --space-6:16.8px --space-8:22.4px`, `--radius-sm:4px --radius-md:8px --radius-lg:14px`, font `Inter` (heading weight 500).

Animations declared in the doc: `@keyframes shimmer` (opacity .35→.7→.35) driving `.sk { animation: shimmer 1.6s ease-in-out infinite; background:#262a2d; border-radius:6px }`, and `@keyframes spin` driving `.sp { animation: spin 1s linear infinite }`.

Canvas page header strings (outside the phones, useful for context): `My Fit`, `Complete state inventory · graphite & silver`, `Every screen, every state`, legend chips `Brass — action, focus, live`, `Emerald — success, records, sync healthy`, `Ruby — destructive, failure, offline`, `Graphite — surfaces, skeletons, disabled`. Section heads: `A / Auth / S-01 → S-06 · single account, registration closes after the first`, `B / Shell & Today / S-07 → S-16 · services, sync, the home surface`, `C / Live session / S-17 → S-29 · logging, editing and deleting sets and exercises`, `D / History, progress, templates / S-30 → S-40`, `E / My gyms / S-41 → S-48 · location, permissions, visits`, `F / Notifications, skeletons, tokens / S-49 → S-50 · the pieces every screen reuses`.

---

# A · AUTH (S-01 → S-06)

All six share the auth body: `flex:1; flex-column; justify-content:center; padding:0 28px 40px; gap:var(--space-3)`, opened by `i.ph-bold.ph-barbell` 28px `#d9a24f`, then a 32px/-0.025em wordmark with `margin-top:var(--space-4)`. No tab bar.

## S-01 · Sign in · idle

Default entry for a signed-out visitor.

```
.phone > MFStatus
      > .auth-body
        ├ i.ph-bold.ph-barbell (28px, accent)
        ├ .title (32px, -0.025em)                    "My Fit"
        ├ .sub (13px, neutral-500, mb space-6)       "Everything you lift, in one place."
        ├ input.input[placeholder] (min-height 48)
        ├ input.input[type=password][placeholder]
        ├ button.btn.btn-primary (48px, 15px, mt space-3)
        └ .footer-link (center, 12px, neutral-600, pt 8px)
```

**Text:** `My Fit` · `Everything you lift, in one place.` · placeholder `Email or username` · placeholder `Password` · button `Sign in` · `New here? Create an account`
**Affordances:** two text fields, one primary button, one inline text link.
_Canvas note:_ "Default entry for a signed-out visitor. Primary stays outlined — never a filled block."

## S-02 · Sign in · wrong credentials

Same skeleton, values filled, error under the password field.

```
… ├ input.input[value="andrii"]
  ├ input.input[type=password][value="••••••"]  style border-color:var(--color-danger)
  ├ .field-error (flex, gap 8, 12px, color var(--color-danger-text))
  │    └ i.ph-bold.ph-warning-circle (14px, --color-danger)
  ├ button.btn.btn-primary (mt space-2)
  └ .footer-link
```

**Text:** `My Fit` · `Everything you lift, in one place.` · value `andrii` · value `••••••` · `Wrong username or password` · `Sign in` · `New here? Create an account`
**State styling:** password input border → `--color-danger`; message is inline, ruby text, never a toast.
_Canvas note:_ "401 from `/api/auth/login`. Field takes a ruby border; message sits under the field, never as a toast."

## S-03 · Sign in · server unreachable

```
… ├ .title "My Fit"
  ├ .banner.danger  (flex gap 10, padding 12px 13px, radius md,
  │                  background --color-danger-tint,
  │                  box-shadow inset 0 0 0 1px --color-danger-line,
  │                  margin var(--space-2) 0 var(--space-4))
  │    ├ i.ph-bold.ph-cloud-slash (16px, danger)
  │    └ span (12px/1.5, --color-danger-text)
  ├ input.input[disabled] ×2
  ├ button.btn.btn-primary[disabled] (48px)
  └ button.btn.btn-secondary (42px, 13px, gap 7) + i.ph-bold.ph-arrow-clockwise
```

**Text:** `My Fit` · `Can't reach the server. The first sign-in needs a connection — offline logging works after that.` · placeholders `Email or username` / `Password` · `Sign in` · `Retry`
**State styling:** `:disabled` = opacity 0.45 (DS rule) on both inputs and primary; secondary Retry stays enabled.
_Canvas note:_ "Fetch to `/api/auth/status` failed. Controls drop to 45% and a Retry appears."

## S-04 · Sign in · submitting

```
… ├ input.input[value="andrii"][disabled]
  ├ input.input[type=password][value="••••••••"][disabled]
  └ button.btn.btn-primary[disabled] (48px, gap 9)
       └ span.sp (14×14, border 2px solid var(--color-accent-800),
                  border-top-color var(--color-accent), radius 50%)
```

**Text:** `My Fit` · `Everything you lift, in one place.` · `andrii` · `••••••••` · button label `Signing in…`
**State styling:** spinner replaces icon, button keeps 48px height (no layout shift), disabled 45%.

## S-05 · Sign up

```
… ├ .title (32px)                     "Create your account"
  ├ .note.ok (flex gap 9, padding 11px 12px, radius md,
  │           background --color-ok-tint, mb space-4)
  │    ├ i.ph-bold.ph-shield-check (15px, --color-ok)
  │    └ span (12px/1.5, --color-ok-text)
  ├ input.input ×3 (48px)
  └ button.btn.btn-primary (48px, 15px, mt space-2)
```

**Text:** `Create your account` · `Your log is private to your account. Free while My Fit is in beta.` · placeholders `Username`, `Email`, `Password (min. 6 characters)` · button `Create account`
_Canvas note:_ "Sign-up is open to anyone. The emerald note is a reassurance, not a success message."

## S-06 · Register · validation

```
… ├ .title "Create your account"
  ├ spacer div (height var(--space-4))
  ├ input.input[value="andrii"]
  ├ input.input[value="andrii@"]  border-color danger
  ├ .field-error + ph-warning-circle
  ├ input.input[type=password][value="•••"]  border-color danger
  ├ .field-error + ph-warning-circle
  └ button.btn.btn-primary[disabled]
```

**Text:** `Create your account` · `andrii` · `andrii@` · `That email doesn't look complete` · `•••` · `6 characters minimum` · `Create account`
**State styling:** two ruby-bordered inputs, two ruby inline errors, submit disabled (45%).
_Canvas note:_ "Validation runs on blur; the submit stays disabled until every field is clean."

---

# B · SHELL & TODAY (S-07 → S-16)

Today/Services body: `flex:1; overflow hidden; padding:12px 20px 20px` (Services uses `14px 20px 20px`), `flex column; gap:var(--space-4)` (skeleton/empty use `--space-6`).

**Today header pattern (S-11…S-16):**

```
.today-head (flex, align-items flex-start, justify-content space-between, padding-top 6px)
  ├ div
  │   ├ .kicker (11px, letter-spacing .12em, uppercase, neutral-600)  "Friday, 31 July"
  │   └ .headline (30px, -0.025em, margin-top 5px)
  └ .sync-chip (flex, gap 6, 11px, margin-top 4px) → dot 7×7 radius 50% + label
```

## S-07 · Services · synced

```
.phone > MFStatus
      > .services-body (padding 14px 20px 20px, gap space-4)
        ├ .row (space-between): .h1 (22px,-0.02em) "Services" | .link (13px, accent) "Sign out"
        ├ .tile.active  (surface, border 1px var(--color-accent-800), radius lg, padding 18,
        │                flex gap 14, align center)
        │    ├ .icon 44×44 radius 12 bg --color-accent-900 color --color-accent-300
        │    │     └ i.ph-bold.ph-barbell 22px
        │    ├ .txt: 16px title + 12px neutral-500 sub
        │    └ span.tag.tag-accent
        ├ .tile.soon (surface, radius lg, padding 18, opacity 0.4)
        │    ├ .icon 44×44 radius 12 bg --color-neutral-900 + i.ph-bold.ph-carrot
        │    └ 16px "Nutrition" + 12px "Soon"
        ├ .tile.soon  (… i.ph-bold.ph-robot) "AI body scan" / "Soon"
        └ .footer-status (margin-top auto, 12px, neutral-600) dot #4cbe8c + label
      > MFTabs active="apps"
```

**Text:** `Services` · `Sign out` · `Training` · `Workouts, sets, weights, gyms` · tag `3 this week` · `Nutrition` · `Soon` · `AI body scan` · `Soon` · `Synced`
**State styling:** "soon" tiles inert at `opacity:0.4`, neutral-900 icon plate; active tile gets accent-800 hairline border.

## S-08 · Services · offline with queue

```
… ├ .row: "Services" | "Sign out"
  ├ .banner.offline (flex gap 10, padding 11px 13px, radius md,
  │                  background --color-danger-tint,
  │                  box-shadow inset 3px 0 0 var(--color-danger))
  │    └ i.ph-bold.ph-cloud-slash 16px danger + span 12px/1.45 danger-text
  ├ .tile.active (Training)
  └ .footer-status (danger-text) dot #e2564f + label
> MFTabs active="apps"
```

**Text:** `Services` · `Sign out` · `Offline · 6 changes queued. Nothing is lost — they replay in order.` · `Training` · `Works offline · 6 queued` · `Offline · last sync 41 min ago`
**State styling:** left 3px ruby rail (inset box-shadow) is the offline banner signature; no border ring.

## S-09 · Sign out · confirm

```
.phone(position relative)
  ├ MFStatus
  ├ .services-body  opacity:0.3   ("Services" + three 80px surface blocks)
  └ .scrim (position absolute inset 0, background rgba(10,11,13,0.66),
            display grid, place-items center, padding 22px)
       └ .dialog (width 100%, surface, radius lg, padding 18, shadow-lg,
                  flex column gap var(--space-3))
            ├ .title 17px
            ├ .body 13px/1.55 neutral-400
            └ .actions (flex gap 10, justify flex-end, mt space-2)
                 ├ button.btn.btn-secondary (40px, 14px)
                 └ button.danger-outline (40px, padding 0 16px, radius md,
                        background transparent, border 1px var(--color-danger),
                        color var(--color-danger), 14px)
```

**Text:** `Services` (dimmed) · `Sign out?` · `6 changes are still queued. Signing out discards the local queue — sync first if you want to keep them.` · `Stay` · `Sign out`
_Canvas note:_ "Destructive dialogs name the loss before the verb."

## S-10 · Today · skeleton

```
.phone > MFStatus
      > .body (padding 12px 20px 20px, gap var(--space-6))
        ├ head stack: .sk 120×10 + .sk 210×26 (gap 9, padding-top 6)
        ├ week strip: 7 × .sk flex:1 height 46
        ├ .sk height 62, border-radius 14      (primary button placeholder)
        ├ row: 2 × .sk flex:1 height 92        (quick-action tiles)
        └ recent list: .sk 70×9 label, then 3 rows of
             [.sk 40×9] + [.sk 120/96/130 ×13 over .sk 180/164/150 ×9]
      > MFTabs active="today"
```

**Text:** none (pure skeleton).
**State styling:** every block is `.sk` = `#262a2d`, radius 6 (overridden to 14 on the big block), shimmering 1.6s ease-in-out infinite.
_Canvas note:_ "Shown until the local cache resolves. Blocks mirror the real boxes and breathe at 1.6s — never a spinner."

## S-11 · Today · empty (first run)

```
… ├ .today-head → "Friday, 31 July" / "Nothing logged yet." | sync-chip(ok dot) "Synced"
  ├ button.btn.btn-primary (min-height 62, 16px, radius lg, gap 10)
  │      └ i.ph-bold.ph-play 18px + label
  ├ .empty (flex column align flex-start, gap space-3, padding var(--space-8) 0)
  │      ├ i.ph-bold.ph-barbell 26px neutral-700
  │      ├ 17px title
  │      └ 13px neutral-500, line-height 1.55, max-width 34ch
  └ .gym-hint (margin-top auto, flex gap 9, padding 12px 13px, radius md, surface)
         ├ i.ph-bold.ph-map-pin 15px accent
         ├ span 12px neutral-400 flex:1
         └ span 12px accent "Add"
> MFTabs active="today"
```

**Text:** `Friday, 31 July` · `Nothing logged yet.` · `Synced` · `Start your first session` · `No history yet` · `Log a session and this fills with your weeks. Templates show up after the second one — they're just sessions you kept.` · `Add your gym so unlogged visits can remind you.` · `Add`

## S-12 · Today · filled + gym reminder

```
… ├ .today-head "Friday, 31 July" / "Nothing logged yet." + "Synced"
  ├ .weekstrip (flex gap 6) — 7 cells: flex:1, text-center, padding 9px 0,
  │     radius md, surface; day letter 10px neutral-600 (today = neutral-400),
  │     dot 6×6 radius 50% margin 7px auto 0
  │     M=accent, T=neutral-800, W=accent, T=neutral-800,
  │     F=neutral-800 + box-shadow 0 0 0 3px var(--color-neutral-900) (today ring),
  │     S=accent, S=neutral-800
  ├ .reminder (flex gap 11, padding 13px 14px, radius md, surface,
  │            box-shadow inset 3px 0 0 var(--color-accent))
  │     ├ i.ph-bold.ph-map-pin 16px accent
  │     └ div: 13px/1.5 neutral-300 with <strong color:var(--color-text)>
  │            + actions row (gap 14): accent link + neutral-600 link
  ├ button.btn.btn-primary (60px, 16px, radius lg, gap 10) + ph-play
  ├ .quick (flex gap 10) — 2 × tile (flex:1, surface, radius md, padding 14):
  │     icon 16px accent, 14px title mt 8, 11px neutral-500 mt 3
  ├ .section-label (11px, .12em, uppercase, neutral-600, mt space-2) "Recent"
  ├ .recent-row (flex align baseline gap 12, padding 12px 0,
  │              box-shadow 0 1px 0 var(--color-divider))
  │     ├ 44px 11px neutral-600 date
  │     ├ flex:1 → 15px name (+ optional .tag.tag-neutral margin-left 6px)
  │     │            + 11px neutral-500 stats mt 3
  │     └ i.ph-bold.ph-arrow-up-right 13px neutral-700
  └ .recent-row (last, no divider)
> MFTabs active="today"
```

**Text:** `Friday, 31 July` · `Nothing logged yet.` · `Synced` · day letters `M` `T` `W` `T` `F` `S` `S` · `1h 20m at Smartass Obolon on 12 Jul with nothing logged.` (with `Smartass Obolon` bolded) · `Log it` · `Dismiss` · `Start empty session` · `Repeat Push day` · `Wed · 5 exercises` · `Templates` · `4 saved` · `Recent` · `29 JUL` `Push day` `18 sets · 4 980 kg · 1:12` · `27 JUL` `Legs` tag `Auto-closed` `14 sets · 3 420 kg · 0:54`
**Affordances:** reminder has two inline actions (`Log it` accent / `Dismiss` muted); recent rows are tappable (arrow glyph).
_Canvas note:_ "The reminder card is the only element allowed above the primary action."

## S-13 · Today · live session bar

```
… ├ .today-head "Friday, 31 July" / "Mid-session." + "Synced"
  ├ .live-card (border 1px var(--color-accent), background var(--color-accent-900),
  │             radius lg, padding 17, flex align center gap 13)
  │     ├ dot 9×9 radius 50% accent
  │     ├ flex:1 → 16px title + 12px --color-accent-300 tabular-nums meta (mt 3)
  │     └ i.ph-bold.ph-arrow-right 18px accent
  ├ .section-label "Recent"
  └ 3 × .recent-row (first two with divider shadow, no arrow glyph)
> MFTabs active="today"
```

**Text:** `Friday, 31 July` · `Mid-session.` · `Synced` · `Session in progress` · `24:18 · 7 sets · 2.1 t` · `Recent` · `29 JUL / Push day / 18 sets · 4 980 kg · 1:12` · `27 JUL / Legs / 14 sets · 3 420 kg · 0:54` · `25 JUL / Pull day / 21 sets · 5 640 kg · 1:03`
_Canvas note:_ "The live card replaces the start button; the dot breathes at 2.6s so the screen has one heartbeat."

## S-14 · Today · offline, queued

```
… ├ .today-head … sync-chip color --color-danger-text, dot --color-danger  "Offline"
  ├ .banner.offline (danger-tint + inset 3px 0 0 danger) + ph-cloud-slash
  ├ button.btn.btn-primary (60px) + ph-play
  ├ .caption 11px neutral-600 (padding 0 2px)
  ├ .recent-row (with tag.tag-neutral)
  └ .recent-row
> MFTabs active="today"
```

**Text:** `Friday, 31 July` · `Nothing logged yet.` · `Offline` · `No connection. 2 changes queued — they'll sync on their own.` · `Start empty session` · `Everything below is served from the local cache.` · `29 JUL / Push day` + tag `Queued` / `18 sets · 4 980 kg` · `27 JUL / Legs / 14 sets · 3 420 kg`
_Canvas note:_ "Queued records carry a neutral tag, never a ruby one — they aren't broken."

## S-15 · Today · syncing progress

```
… ├ .today-head … sync-chip color neutral-400 with span.sp
  │     (11×11, border 2px var(--color-neutral-800), border-top-color accent)  "Syncing"
  ├ .sync-card (padding 12px 13px, radius md, surface)
  │     ├ row: i.ph-bold.ph-arrows-clockwise 15px accent + 12px neutral-300 label
  │     │       + 12px neutral-500 tabular counter
  │     └ .progress (height 3, radius 2, bg neutral-900, mt 10, overflow hidden)
  │            └ .fill width 66%, background var(--color-accent)
  ├ button.btn.btn-primary (60px) + ph-play
  └ .recent-row
> MFTabs active="today"
```

**Text:** `Friday, 31 July` · `Nothing logged yet.` · `Syncing` · `Sending queued changes` · `4 / 6` · `Start empty session` · `29 JUL / Push day / 18 sets · 4 980 kg`
_Canvas note:_ "The only determinate progress bar in the product — the queue has a known length."

## S-16 · Today · sync failed

```
… ├ .today-head … sync-chip danger dot  "Failed"
  ├ .error-card (padding 13px 14px, radius md, background danger-tint,
  │              box-shadow inset 0 0 0 1px var(--color-danger-line))
  │     ├ row: i.ph-bold.ph-warning-octagon 16px danger
  │     │      + 13px/1.5 danger-text message
  │     │      + 11px danger-text opacity .7 tabular-nums technical line (mt 5)
  │     └ actions (flex gap 9, mt 12)
  │           ├ button.btn.btn-secondary (36px, 13px, gap 6) + ph-arrow-clockwise
  │           └ button.danger-outline (36px, padding 0 14px, radius md,
  │                  border 1px danger, color danger, 13px)
  ├ button.btn.btn-primary (60px) + ph-play
  └ .recent-row
> MFTabs active="today"
```

**Text:** `Friday, 31 July` · `Nothing logged yet.` · `Failed` · `Sync failed on change 3 of 6 — the server rejected a workout that no longer exists.` · `409 · upsert workout 4f2c…` · `Retry` · `Discard change` · `Start empty session` · `29 JUL / Push day / 18 sets · 4 980 kg`
_Canvas note:_ "A blocked queue is the one case that earns a persistent card with the raw reason and two exits."

---

# C · LIVE SESSION (S-17 → S-29)

**Session top bar pattern (S-17, S-19, S-20, S-22, S-23, S-26, S-27, S-30):**

```
.session-top (flex:none, flex, align center, gap 10, padding 6px 14px 12px)
  ├ i.ph-bold.ph-caret-left (20px, neutral-300, width 36, text-align center)
  ├ div flex:1
  │    ├ .kicker 11px .12em uppercase — color accent when live, neutral-500/600 otherwise
  │    └ .clock 22px, -0.02em, font-variant-numeric tabular-nums
  └ button.btn.btn-secondary (font-size 13px)   ["Finish" / "Reopen"; disabled in S-17]
```

**Set table grid (used in every session/exercise card):** `display:grid; grid-template-columns:18px 1fr 1fr 62px; gap:8px`.

- Header row: 10px, `.08em`, uppercase, neutral-600, `padding-bottom:4px` — cells `#`, `Reps`, `Kg`, ``(empty)
- Logged row: `align-items:center; padding:7px 0; font-size:16px; tabular-nums; box-shadow:0 1px 0 var(--color-divider)`; index 11px neutral-600; warm-up rows have values in neutral-500; 4th cell = 10px neutral-600 right-aligned tag word
- **Ghost row:** `padding:9px 0 2px`, values `color:var(--color-neutral-400); border-bottom:1px dashed var(--color-neutral-700); padding-bottom:2px`, index neutral-700, and a `button.btn.btn-primary` `height:34px; padding:0; font-size:13px`
- Record row (S-20): whole row gets `background:var(--color-ok-tint); border-radius:6px`, index `--color-ok`, values `--color-ok-text`, tag word `record` in `--color-ok`

**Exercise card:** `border-radius:var(--radius-md); background:var(--color-surface); padding:13px 14px`; header row `flex; gap 8; margin-bottom:8px` = 15px name (flex:1) + 11px neutral-600 `prev …` + `i.ph-bold.ph-dots-three-vertical` 16px neutral-600.

**Session stats strip (S-19, S-26):** `flex:none; flex; gap 18; padding 0 18px 12px; tabular-nums` — each item 18px value + 10px `.08em` uppercase neutral-600 label.

**Bottom sheet pattern (S-18, S-21, S-24, S-39, S-40, S-47):**

```
.scrim  position:absolute; inset:0; background:rgba(10,11,13,0.6)
.sheet  position:absolute; left:0; right:0; bottom:0; background:var(--color-surface);
        border-radius:20px 20px 0 0; box-shadow:var(--shadow-lg);
        padding:14px 16-18px 24-26px; flex column
        └ .grabber 34×4, radius 2, background var(--color-neutral-700), align-self center
(behind it the page content is rendered at opacity:0.3)
```

**Dialog pattern (S-09, S-25, S-28, S-31, S-48):** scrim `rgba(10,11,13,0.66)` + `display:grid; place-items:center; padding:22px`; card `width:100%; surface; radius lg; padding:18; shadow-lg; gap var(--space-3)`; title 17px; body 13px/1.55 neutral-400; actions right-aligned gap 10.

**Snackbar pattern (S-22, S-26):** `flex:none; margin:0 18px 26px; flex align center gap 12; padding:13px 14px; radius md; background:var(--color-surface); box-shadow:var(--shadow-md)` — icon + 13px neutral-300 text + accent `Undo` + 11px neutral-600 tabular countdown.

## S-17 · Session · empty

```
.phone > MFStatus
      > .session-top (kicker accent, clock, Finish DISABLED)
      > .empty (flex:1, column, align flex-start, justify center,
                gap space-3, padding 0 26px 60px)
          ├ i.ph-bold.ph-list-plus 26px neutral-700
          ├ 18px title
          ├ 13px neutral-500 /1.55, max-width 32ch
          ├ button.btn.btn-primary (46px, 15px, gap 8, mt space-3) + ph-plus
          └ 12px neutral-600 (mt space-2)
```

**Text:** `In session · Smartass Obolon` · `0:14` · `Finish` (disabled) · `No exercises yet` · `Add the first one — recent lifts and your whole history come up as you type.` · `Add exercise` · `or load a template`

## S-18 · Add exercise · search sheet

```
.phone(relative)
  ├ MFStatus
  ├ .dimmed (flex:1, padding 6px 18px, opacity .3): "24:18" 22px + 150px surface block
  ├ .scrim rgba(10,11,13,.6)
  └ .sheet (padding 14px 16px 24px, gap 10, max-height 74%)
       ├ .grabber
       ├ .searchbar (flex gap 10, background var(--color-bg), radius md,
       │             padding 10px 12px, mt 6)
       │    ├ i.ph-bold.ph-magnifying-glass 16px neutral-500
       │    ├ span 15px (query text)
       │    └ caret span 1×18 background var(--color-accent)
       ├ .list-label (10px, .1em, uppercase, neutral-600, padding 8px 4px 2px)
       ├ 3 × .result-row (flex align center gap 10, padding 11px 4px,
       │      box-shadow 0 1px 0 var(--color-divider))
       │      → 15px name with matched substring wrapped in <span color:accent>
       │        + 11px neutral-600 "last …"
       └ .create-row (flex gap 10, padding 11px 4px, color accent)
              └ i.ph-bold.ph-plus 15px + 15px label
```

**Text:** `24:18` · query `squ` · `Matches` · `Squat · back` + `last 85 × 8` · `Squat · front` + `last 65 × 8` · `Bulgarian split squat` + `last 24 × 10` · `Create “squ”`
**State styling:** matched substring `Squ` / `squ` painted in `--color-accent` inside each row.

## S-19 · Session · logging (ghost row) — the core loop

```
.phone > MFStatus
      > .session-top (accent kicker, "24:18", Finish enabled)
      > .stats-strip  [7 sets | 2.1 t moved | 2 exercises]
      > .body (flex:1, padding 0 18px 18px, gap space-4)
          ├ .exercise-card (Back Squat)
          │    ├ header: name + i.ph-bold.ph-caret-right 12px neutral-700
          │    │          + "prev 85 × 8" + ph-dots-three-vertical
          │    ├ header-row (#, Reps, Kg, —)
          │    ├ set 1 warm-up (values neutral-500)
          │    ├ set 2 working
          │    ├ set 3 record (tag word in --color-ok)
          │    ├ ghost row 4 + button.btn.btn-primary "Log"
          │    └ .hint 10px neutral-600 mt 7
          ├ .exercise-card (Romanian Deadlift)
          │    ├ header + "prev 70 × 10" + ⋮
          │    ├ set 1 working
          │    └ ghost row 2 + "Log"
          └ button.btn.btn-secondary (44px, gap 8, 14px) + ph-plus
```

**Text:** `In session · Smartass Obolon` · `24:18` · `Finish` · `7`/`sets` · `2.1 t`/`moved` · `2`/`exercises` · `Back Squat` · `prev 85 × 8` · `#` `Reps` `Kg` · rows `1 12 40 warm-up`, `2 8 80 working`, `3 8 85 record`, ghost `4 8 85` + `Log` · `Prefilled from last time · tap a number to nudge it` · `Romanian Deadlift` · `prev 70 × 10` · `1 10 70 working`, ghost `2 10 72.5` + `Log` · `Add exercise`

## S-20 · Set logged · PR + rest timer

```
.phone(relative)
  ├ MFStatus
  ├ .session-top (kicker "In session", clock 25:02, Finish)
  ├ .body (flex:1, padding 0 18px 18px)
  │     └ .exercise-card (Back Squat, header without ⋮)
  │          ├ set 3 working
  │          ├ set 4 RECORD ROW  (background ok-tint, radius 6, ok-text values)
  │          └ ghost row 5 + "Log"
  ├ .rest-bar (flex:none, margin 0 18px 12px, background var(--color-accent-900),
  │            radius md, padding 11px 14px, flex align center gap 12)
  │     ├ i.ph-bold.ph-timer 17px --color-accent-300
  │     ├ span flex:1 13px --color-accent-200
  │     ├ span 18px tabular --color-accent-100
  │     └ span 12px --color-accent-300  (skip affordance)
  └ .toast.ok (flex:none, margin 0 18px 22px, padding 12px 14px, radius md,
               background ok-tint, box-shadow var(--shadow-md))
        └ i.ph-bold.ph-trophy 17px ok + 13px ok-text
```

**Text:** `In session` · `25:02` · `Finish` · `Back Squat` · `prev 85 × 8` · `3 8 85 working` · `4 8 90 record` · ghost `5 8 90` + `Log` · `Rest` · `1:24` · `Skip` · `New record · Back Squat 90 kg × 8`
_Canvas note:_ "Rest starts on Log and counts down in place. The PR toast holds 3.2s; the row keeps its emerald tint for the session."

## S-21 · Edit set · sheet

```
.phone(relative) > MFStatus
  ├ .dimmed (opacity .3): "25:02" + 190px surface block
  ├ .scrim rgba(10,11,13,.6)
  └ .sheet (padding 14px 18px 26px, gap space-4)
       ├ .grabber
       ├ .sheet-head (flex baseline gap 8, mt 4): 17px flex:1 title + 11px neutral-600 meta
       ├ .steppers (flex gap 10) — two boxes, flex:1, background var(--color-bg),
       │    radius md, padding 10px 12px; the focused one adds
       │    box-shadow: inset 0 0 0 1px var(--color-accent)
       │      ├ label 10px .1em uppercase neutral-600
       │      └ row: "−" 22px neutral-400 | value 24px tabular centered | "+" 22px neutral-400
       ├ .toggle-row (flex gap 12, padding 12px 14px, radius md, background var(--color-bg))
       │      ├ i.ph-bold.ph-flame 16px neutral-500
       │      ├ 14px label flex:1
       │      └ switch OFF: 40×24 radius 12 background neutral-800,
       │              knob 18×18 radius 50% background neutral-500 at top 3 left 3
       └ .actions (flex gap 10)
              ├ button.danger-outline (flex:none, 44px, padding 0 16px, radius md,
              │      border 1px danger, color danger, 14px, gap 7) + i.ph-bold.ph-trash
              ├ button.btn.btn-secondary (flex:1, 44px, 14px)
              └ button.btn.btn-primary   (flex:1, 44px, 14px)
```

**Text:** `25:02` · `Set 2 · Back Squat` · `logged 24:02` · `Reps` · `−` `8` `+` · `Weight, kg` · `−` `80` `+` · `Warm-up set` · `Delete set` · `Cancel` · `Save`
_Canvas note:_ "Tapping any logged row opens this. Steppers, not a keyboard; delete lives left, away from Save."

## S-22 · Set deleted · undo

```
.phone(relative) > MFStatus > .session-top ("In session", 25:40, Finish)
  ├ .body > .exercise-card (Back Squat: set1 warm-up, set2 working, ghost 3 + Log)
  └ .snackbar (margin 0 18px 26px, surface, radius md, padding 13px 14px, shadow-md)
        ├ i.ph-bold.ph-trash 16px danger
        ├ span flex:1 13px neutral-300
        ├ span 13px accent   "Undo"
        └ span 11px neutral-600 tabular   "4s"
```

**Text:** `In session` · `25:40` · `Finish` · `Back Squat` · `prev 85 × 8` · `1 12 40 warm-up` · `2 8 85 working` · ghost `3 8 85` + `Log` · `Set deleted · 8 × 80 kg` · `Undo` · `4s`
_Canvas note:_ "A single set deletes with no dialog — the undo snackbar is the safety net (5s, then it commits to the queue). Remaining sets renumber immediately."

## S-23 · Rename exercise · inline (with keyboard)

```
.phone(relative) > MFStatus > .session-top ("In session", 26:11, Finish)
  ├ .body > .exercise-card
  │     ├ edit row (flex gap 8, mb 10)
  │     │     ├ input.input[value] flex:1, min-height 40, 15px,
  │     │     │        border-color var(--color-accent)
  │     │     └ button.btn.btn-primary height 40, padding-inline 12, 13px
  │     ├ .hint 11px neutral-600 mb 8
  │     └ two logged rows at opacity:0.6
  └ .keyboard (flex:none, height 290, background surface,
               box-shadow 0 -1px 0 var(--color-divider), padding 10, gap 8)
        ├ .kb-label (flex, 11px neutral-500, padding 0 4px 4px)
        └ grid repeat(10,1fr) gap 5 of neutral-800 keys, radius 5;
          last row: span 2 + span 6 + span 2 (the last key background accent-800)
```

**Text:** `In session` · `26:11` · `Finish` · field value `Back Squat` · `Save` · `Renaming affects this session only — history keeps the old name.` · rows `1 12 40 warm-up`, `2 8 85 working` · `Keyboard`
**State styling:** logged rows dim to `opacity:0.6` while the title is being edited; input border switches to accent.

## S-24 · Exercise menu (action sheet)

```
.phone(relative) > MFStatus
  ├ .dimmed ("26:40" + 190px block, opacity .3)
  ├ .scrim rgba(10,11,13,.6)
  └ .sheet (padding 14px 12px 26px, gap 2)
       ├ .grabber (mb 10)
       ├ .sheet-label (11px .1em uppercase neutral-600, padding 0 10px 8px)
       ├ 5 × .menu-item (flex align center gap 13, padding 14px 10px, 15px)
       │      with i.ph-bold.* 18px neutral-400
       ├ .rule (height 1, background var(--color-divider), margin 6px 10px)
       └ .menu-item.danger (color var(--color-danger)) + i.ph-bold.ph-trash 18px
```

**Text:** `26:40` · `Back Squat · 3 sets` · `Rename` (`ph-pencil-simple`) · `Duplicate with sets` (`ph-copy`) · `Reorder` (`ph-arrows-down-up`) · `Open history` (`ph-chart-line-up`) · `Clear all sets` (`ph-eraser`) · `Delete exercise` (`ph-trash`, ruby)

## S-25 · Delete exercise · confirm

```
.phone(relative) > MFStatus > .dimmed ("26:52" + block)
  └ .dialog-scrim rgba(10,11,13,.66)
       └ .dialog
            ├ title row: i.ph-bold.ph-trash 17px danger + 17px text
            ├ body 13px/1.55 neutral-400
            └ actions: btn-secondary + danger-outline
```

**Text:** `26:52` · `Delete “Back Squat”?` · `3 logged sets go with it — 12 × 40, 8 × 80, 8 × 85. Added by mistake? Deleting is instant, with a 5-second undo.` · `Keep` · `Delete`

## S-26 · Exercise deleted · undo

```
.phone(relative) > MFStatus > .session-top ("In session", 27:03, Finish)
  ├ .stats-strip  [1 sets | 0.7 t moved | 1 exercises]
  ├ .body: .exercise-card (Romanian Deadlift, ⋮, set 1 + ghost 2 + Log)
  │        + button.btn.btn-secondary "Add exercise"
  └ .snackbar (trash icon + text + Undo + 5s)
```

**Text:** `In session` · `27:03` · `Finish` · `1`/`sets` · `0.7 t`/`moved` · `1`/`exercises` · `Romanian Deadlift` · `prev 70 × 10` · `1 10 70 working` · ghost `2 10 72.5` + `Log` · `Add exercise` · `“Back Squat” deleted · 3 sets` · `Undo` · `5s`

## S-27 · Session · 8-hour auto-close

```
.phone > MFStatus
  ├ .session-top  (kicker color neutral-500 — NOT accent; clock 8:00:00;
  │                button.btn.btn-secondary "Reopen")
  └ .body (gap space-4)
       ├ .notice.accent (flex gap 11, padding 13px 14px, radius md, surface,
       │                 box-shadow inset 3px 0 0 var(--color-accent))
       │     └ i.ph-bold.ph-clock-countdown 16px accent + 12px/1.5 neutral-300
       └ .exercise-card (header: name flex:1 + span.tag.tag-neutral)
             ├ set 1 warm-up (neutral-500 values, divider)
             └ set 2 working
```

**Text:** `Closed automatically` · `8:00:00` · `Reopen` · `Left open for 8 hours, so it was closed at 18:02 and may be incomplete. Everything you logged is kept — add what's missing and it saves to the original date.` · `Back Squat` · tag `3 sets` · `1 12 40 warm-up` · `2 8 80 working`
_Canvas note:_ "Brass, not ruby: the rule fired as designed. Reopen restarts the clock from the original start."

## S-28 · Finish · empty exercise warning

```
.phone(relative) > MFStatus > .dimmed ("41:07" + 190px block)
  └ .dialog-scrim > .dialog
        ├ 17px title (no icon)
        ├ 13px/1.55 neutral-400 body
        └ actions: button.btn.btn-secondary + button.btn.btn-primary  (NOT danger)
```

**Text:** `41:07` · `Finish this session?` · `“Leg Press” has no sets and will be dropped. Everything else — 11 sets, 3.4 t — is saved to 31 July.` · `Keep going` · `Finish`

## S-29 · Summary · saved

```
.phone > MFStatus
  > .body (padding 14px 22px 24px, gap var(--space-6))
     ├ .saved-mark (flex gap 9, color var(--color-ok))
     │     └ i.ph-fill.ph-check-circle 20px + 11px .12em uppercase label
     ├ .title block: 32px/-0.025em headline + 13px neutral-500 sub (mt 6)
     ├ .stat-grid (grid 1fr 1fr 1fr, gap 8) — cells surface, radius md, padding 13:
     │     22px tabular value + 10px .08em uppercase neutral-600 label (mt 3)
     ├ .pr-panel (radius lg, background ok-tint, padding 16,
     │            box-shadow inset 0 0 0 1px var(--color-ok-line))
     │     ├ row: i.ph-bold.ph-trophy 16px ok + 11px .12em uppercase ok
     │     ├ 24px -0.02em ok-text tabular (mt 9)
     │     └ 12px ok-text opacity .75 (mt 5)
     ├ .compare block
     │     ├ .section-label "Compared to last leg day"
     │     └ 3 rows (flex gap 12, padding 11px 0, 14px, first two with divider)
     │            name flex:1 | tabular neutral-400 value | 12px delta w52 right-aligned
     │            (+ = --color-ok, − = --color-danger)
     └ .actions (flex gap 10, margin-top auto): btn-secondary flex:1 + btn-primary flex:1
```

**Text:** `Session saved` · `Leg day, done.` · `Friday, 31 July · Smartass Obolon` · `41:07`/`Duration` · `11`/`Sets` · `3.4 t`/`Moved` · `New record` · `Back Squat · 90 kg × 8` · `Previous best 85 kg × 8 · estimated 1RM up to 112 kg` · `Compared to last leg day` · `Back Squat` `1 385 kg` `+12%` · `Romanian Deadlift` `700 kg` `−8%` · `Session volume` `3.4 t` `+4%` · `Edit session` · `Done`

---

# D · HISTORY, PROGRESS, TEMPLATES (S-30 → S-40)

## S-30 · Past workout · edit

```
.phone > MFStatus
  ├ .session-top (kicker neutral-600, title 20px -0.02em instead of a clock,
  │               right slot = i.ph-bold.ph-trash 18px danger, width 36, centered)
  └ .body (padding 0 18px 18px, gap space-4)
       ├ .notice.accent (inset 3px accent rail) + ph-clock-countdown
       ├ .exercise-card (Front Squat) — header: name flex:1 + 11px volume + ⋮
       │      header-row (#, Reps, Kg) + 3 logged rows + ghost row with "Add"
       ├ .exercise-card (Leg Press) — 2 logged rows
       ├ button.btn.btn-secondary (44px, gap 8, 14px) + ph-plus
       └ span 13px color var(--color-danger), padding 6px 0
```

**Text:** `Mon 27 July · 08:40 → 09:34` · `Legs` · `Auto-closed after 8 hours — may be incomplete. Anything added here saves to the original date.` · `Front Squat` `960 kg` · `#` `Reps` `Kg` · `1 10 40 warm-up`, `2 8 60 working`, `3 8 65 working`, ghost `4 8 65` + **`Add`** (not "Log") · `Leg Press` `2 460 kg` · `1 12 160 working`, `2 10 170 working` · `Add exercise to this session` · `Delete workout`

## S-31 · Delete workout · confirm

```
.phone(relative) > MFStatus > .dimmed ("Legs" 20px + 190px block)
  └ .dialog-scrim > .dialog (ph-trash + title / body / Keep + danger-outline Delete)
```

**Text:** `Legs` · `Delete this workout?` · `Legs · 27 July, 14 sets, 3 420 kg. It disappears from every device on the next sync and cannot be undone.` · `Keep` · `Delete`
_Canvas note:_ "Whole workouts get a dialog and no undo — the sync makes it irreversible, so say so."

## S-32 · Exercise history

```
.phone > MFStatus
  > .body (padding 6px 20px 20px, gap var(--space-6))
     ├ .head (flex gap 10, padding-top 8)
     │     ├ i.ph-bold.ph-caret-left 19px neutral-300, margin-left -6px
     │     └ div: 26px -0.025em title + 12px neutral-500 sub (mt 3)
     ├ .stat-grid (3 cols, gap 8) — surface, radius md, padding 13;
     │     value 20px tabular (first one colored --color-ok), label 10px uppercase
     ├ .chart block
     │     ├ .section-label "Top set · 12 weeks"
     │     └ .chart-card (surface, radius lg, padding 16px 14px 10px)
     │           ├ svg viewBox 0 0 300 96, height 96
     │           │    polyline stroke var(--color-accent) width 2, round joins
     │           │    circle r=4 fill var(--color-ok) at the last point
     │           └ axis row (10px neutral-600, space-between; right label ok-colored)
     └ .table block
           ├ .section-label "Last sessions"
           └ table.table  (th: Date / Top set / Volume; 4 tbody rows, tabular-nums)
```

**Text:** `Back Squat` · `14 sessions · since March` · `110`/`Record kg` · `120`/`Est. 1RM` · `85`/`Last top set` · `Top set · 12 weeks` · `60 kg` · `110 kg · record` · `Last sessions` · `Date` `Top set` `Volume` · `29 Jul / 85 × 8 / 1 385 kg` · `25 Jul / 82.5 × 8 / 1 240 kg` · `21 Jul / 80 × 8 / 1 180 kg` · `17 Jul / 80 × 6 / 1 060 kg`

## S-33 · Exercise history · too little data

Same skeleton as S-32; the chart card is replaced by an empty state.

```
… ├ .stat-grid: value / "—" in neutral-700 / value
  ├ .empty-card (surface, radius lg, padding 26px 18px, column, align flex-start, gap 10)
  │     ├ i.ph-bold.ph-chart-line 22px neutral-700
  │     ├ 15px title
  │     └ 12px neutral-500 /1.55
  └ .table block (one row)
```

**Text:** `Bulgarian split squat` · `1 session` · `24`/`Record kg` · `—`/`Est. 1RM` · `24`/`Last top set` · `Not enough to draw a line` · `Three sessions and the trend appears here. One point isn't a trend.` · `Last sessions` · `Date` `Top set` `Volume` · `25 Jul / 24 × 10 / 480 kg`

## S-34 · Progress · skeleton

```
.phone > MFStatus
  > .body (padding 12px 20px 20px, gap var(--space-8))
     ├ head: .sk 150×34 + .sk 110×9 (gap 10, pt 8)
     ├ bar chart: 10 × .sk flex:1 with heights 38/52/44/66/58/71/74/69/88/100 %,
     │            container height 140, align-items flex-end, gap 7
     ├ .sk height 140, border-radius 14
     └ list: .sk 80×9 + 3 rows [.sk flex:1 ×13] [.sk 60×13]
  > MFTabs active="progress"
```

**Text:** none.

## S-35 · Progress · filled

```
… ├ .kpi (flex align flex-end gap 14, pt 8)
  │     ├ div: 40px/-0.03em/line-height 1 tabular value with a 16px neutral-500 unit span
  │     │      + 11px .08em uppercase neutral-600 label (mt 7)
  │     └ span.tag.tag-accent (margin-bottom 22px)
  ├ .bars (flex align-end gap 7, height 140) — 10 bars radius 3, heights as S-34;
  │     colors: 5× neutral-800, accent-800, accent-700, accent-700, accent-600, accent
  ├ .chart block
  │     ├ .section-label "Estimated 1RM"
  │     └ .chart-card (surface, radius lg, padding 16px 14px 10px)
  │           ├ svg 0 0 300 100 h100: solid accent polyline (w2)
  │           │       + dashed neutral-700 polyline (w1.5, dasharray "3 4")
  │           └ legend (flex gap 16, 11px neutral-600, mt 8) — 10×2px swatches
  └ .records block
        ├ .section-label "Records"
        └ 3 rows (flex gap 12, padding 12px 0, first two with divider)
              name 15px flex:1 | 15px tabular value | tag.tag-accent OR 11px neutral-600
  > MFTabs active="progress"
```

**Text:** `14.2` + ` t` · `Volume this week` · tag `+18%` · `Estimated 1RM` · `Squat 120 kg` · `Bench 93 kg` · `Records` · `Back Squat` `110 kg` tag `+5` · `Bench Press` `82.5 kg` tag `+2.5` · `Deadlift` `140 kg` `6 wks`
_Canvas note:_ "Only the current week takes the full-chroma bar; history stays graphite."

## S-36 · Progress · empty

```
… ├ .title (30px, -0.025em, pt 8)  "Progress"
  ├ .empty (column, align flex-start, gap space-3, padding var(--space-8) 0)
  │     ├ i.ph-bold.ph-chart-line-up 26px neutral-700
  │     ├ 17px title
  │     └ 13px neutral-500 /1.55 max-width 34ch
  └ .unlock (flex gap 12, padding 13px 14px, radius md, surface)
        ├ 11px neutral-500 flex:1
        └ 3 dots 9×9 radius 50%: [accent, neutral-800, neutral-800]
  > MFTabs active="progress"
```

**Text:** `Progress` · `Two more sessions` · `Volume, records and 1RM estimates need three logged sessions before they mean anything. You have one.` · `Progress unlocks at`

## S-37 · Templates · list

```
.phone > MFStatus
  > .body (padding 6px 20px 20px, gap space-4)
     ├ .head (flex gap 10, pt 8): ph-caret-left 19px + 26px title
     ├ p (13px/1.55 neutral-500, margin 0)
     ├ 3 × .template-card (surface, radius lg, padding 16)
     │      ├ row: 16px name flex:1 + span.tag(.tag-accent | .tag-neutral) + ⋮
     │      ├ 12px neutral-500 exercise list (mt 7, line-height 1.5)
     │      └ .load-link (inline-flex gap 6, 12px accent, mt 12)
     │             + i.ph-bold.ph-arrow-counter-clockwise
     └ button.btn.btn-secondary (44px, gap 8, 14px) + ph-plus
  > MFTabs active="today"
```

**Text:** `Templates` · `A template is a past session you kept. Loading one prefills every exercise with last time's weights.` · `Push day` tag `Used 6×` (accent) · `Bench Press · Incline DB · Dips · Lateral raise · Triceps pushdown` · `Load · 18 sets prefilled` · `Legs · heavy` tag `Used 4×` (neutral) · `Back Squat · Romanian Deadlift · Leg Press · Calf raise` · `Load · 14 sets prefilled` · `Pull day` tag `Used 5×` (neutral) · `Pull-up · Barbell row · Face pull · Curl` · `Load · 16 sets prefilled` · `Save last session as template`

## S-38 · Templates · empty

```
… ├ .head: ph-caret-left + "Templates"
  ├ .empty: i.ph-bold.ph-cards 26px neutral-700 + 17px + 13px/34ch
  └ button.btn.btn-primary (46px, gap 8, 14px) + ph-plus
  > MFTabs active="today"
```

**Text:** `Templates` · `No templates yet` · `Finish a session you'd repeat and keep it — it lands here with every exercise and its weights.` · `Save “Push day” from 29 Jul`

## S-39 · Save as template · sheet

```
.phone(relative) > MFStatus > .dimmed ("Templates" 26px + 150px block)
  ├ .scrim rgba(10,11,13,.6)
  └ .sheet (padding 14px 18px 26px, gap space-4)
       ├ .grabber
       ├ 17px title (mt 4)
       ├ input.input[value] min-height 46, 15px
       ├ .toggle-row (flex gap 12, padding 12px 14px, radius md, background var(--color-bg))
       │     ├ 14px label flex:1
       │     └ switch ON: 40×24 radius 12 background var(--color-accent-800),
       │             knob 18×18 radius 50% background var(--color-accent) at top 3 right 3
       ├ .hint 12px neutral-600 /1.5
       └ .actions (flex gap 10): btn-secondary flex:1 + btn-primary flex:1
```

**Text:** `Templates` · `Save as template` · field value `Legs · heavy` · `Keep last used weights` (toggle ON) · `4 exercises, 14 sets. Warm-ups are kept as warm-ups.` · `Cancel` · `Save template`

## S-40 · Template · menu & delete

```
.phone(relative) > MFStatus > .dimmed ("Templates" + 150px block)
  ├ .scrim
  └ .sheet (padding 14px 12px 26px, gap 2)  — same grammar as S-24
       ├ .grabber (mb 10)
       ├ .sheet-label 11px .1em uppercase neutral-600
       ├ 4 × .menu-item (14px 10px, 15px) with 18px neutral-400 icons
       ├ .rule (1px divider, margin 6px 10px)
       ├ .menu-item.danger (color danger) + ph-trash
       └ .footnote 11px neutral-600, padding 8px 10px 0, line-height 1.5
```

**Text:** `Templates` · `Push day · used 6×` · `Load into a new session` (`ph-play`) · `Rename` (`ph-pencil-simple`) · `Duplicate` (`ph-copy`) · `Refresh weights from last use` (`ph-arrows-clockwise`) · `Delete template` (`ph-trash`, ruby) · `Deleting a template never touches the sessions it came from — undo snackbar, no dialog.`

---

# E · MY GYMS (S-41 → S-48)

Shared body: `padding:6px 20px 20px; gap:var(--space-4)`; title `Gyms` at 26px/-0.025em with `padding-top:8px`. Add row: `flex; gap:8px` → `input.input flex:1 min-height:46` + `button.btn.btn-primary min-height:46 gap:6` with `ph-crosshair`.

## S-41 · Gyms · empty

```
… ├ .title "Gyms"
  ├ p 13px/1.55 neutral-500
  ├ .addrow: input.input[placeholder] + button.btn.btn-primary[disabled] + ph-crosshair
  ├ .empty: i.ph-bold.ph-map-pin 26px neutral-700 + 17px + 13px/34ch
  └ .footnote (margin-top auto, 11px neutral-600 /1.55)
  > MFTabs active="gyms"
```

**Text:** `Gyms` · `Add a gym while standing in it. Open the app there later and the visit is recorded — an unlogged hour shows up on Today.` · placeholder `Gym name` · button `I'm here` (disabled) · `No gyms yet` · `Name it first, then tap “I'm here” — the button stays disabled until there's a name.` · `Browsers don't give background location. Visits are only recorded while the app is open.`

## S-42 · Gyms · locating

```
… ├ .title "Gyms"
  ├ .addrow: input.input[value] + button.btn.btn-primary[disabled] gap 8
  │            └ span.sp 14×14 (accent-800 ring, accent top) + label
  └ .locating-card (radius lg, surface, padding 16, column gap 12)
        ├ row: i.ph-bold.ph-crosshair 16px accent + 14px label flex:1
        ├ .sk height 10 width 70%
        ├ .sk height 10 width 45%
        └ 11px neutral-600 /1.5 note
  > MFTabs active="gyms"
```

**Text:** `Gyms` · value `Smartass Obolon` · button `Locating` (disabled + spinner) · `Reading your position…` · `Accuracy improves for a few seconds — the save waits for the best fix or 8 s, whichever comes first.`

## S-43 · Gyms · permission denied

```
… ├ .title "Gyms"
  ├ .error-card (padding 14, radius md, background danger-tint,
  │              box-shadow inset 0 0 0 1px var(--color-danger-line))
  │     ├ row: i.ph-bold.ph-map-pin-slash 17px danger
  │     │      + div: 14px danger-text heading
  │     │             + 12px/1.5 danger-text opacity .8 body (mt 5)
  │     └ actions (flex gap 9, mt 12): 2 × button.btn.btn-secondary (36px, 13px)
  ├ .addrow with opacity:0.45 wrapper; input disabled; primary disabled
  └ 12px neutral-500 /1.55 note
  > MFTabs active="gyms"
```

**Text:** `Gyms` · `Location is blocked` · `Safari → aA → Website Settings → Location → Allow. Gyms and visit reminders stay off until then.` · `How to fix` · `Try again` · placeholder `Gym name` · `I'm here` · `Everything else in the tracker works exactly as before — this only disables gyms.`

## S-44 · Gyms · GPS too coarse

```
… ├ .title "Gyms"
  ├ .addrow: input.input[value] border-color var(--color-danger) + enabled primary
  ├ .banner.danger (flex gap 9, padding 11px 13px, radius md, danger-tint,
  │                 inset 0 0 0 1px danger-line) + ph-warning-circle 16px
  └ .actions (flex gap 9): 2 × button.btn.btn-secondary (38px, 13px),
        second with i.ph-bold.ph-arrow-clockwise
  > MFTabs active="gyms"
```

**Text:** `Gyms` · value `Smartass Obolon` · `I'm here` · `Location came back at ±240 m — too coarse to pin a gym. Step inside and try again, or save it anyway and widen the radius.` · `Save anyway` · `Retry`

## S-45 · Gym added · success

```
.phone(relative) > MFStatus
  ├ .body: .title "Gyms" + .addrow (enabled)
  │     └ .gym-card (radius lg, surface, padding 15,
  │                  box-shadow inset 0 0 0 1px var(--color-ok-line))
  │          ├ row: 16px name flex:1 + span.tag.tag-accent
  │          └ meta row (space-between, 12px neutral-500, mt 10, tabular)
  ├ .toast.ok  position:absolute; left 18 right 18 bottom 96;
  │            padding 12px 14px; radius md; background ok-tint; shadow-md
  │            └ i.ph-bold.ph-check-circle 17px ok + 13px ok-text
  └ MFTabs active="gyms"
```

**Text:** `Gyms` · placeholder `Gym name` · `I'm here` · `Smartass Obolon` · tag `Inside` · `50.51234, 30.49871 · ±12 m` · `150 m` · toast `Gym added · accuracy ±12 m`
**State styling:** the newly added card is ringed with `--color-ok-line` (1px inset); toast floats 96px above the bottom (clears the 78px tab bar).

## S-46 · Gyms · list, inside radius

```
… ├ .title "Gyms" + .addrow
  ├ .gym-card (radius lg, surface, padding 15)  [inside]
  │     ├ row: 16px name flex:1 + tag.tag-accent + ⋮
  │     ├ meta row (12px neutral-500, mt 10, tabular): coords | radius
  │     ├ .visitbars (flex gap 3, mt 12, align-end, height 26) — 7 bars radius 2:
  │     │     40% accent-800, 70% accent-700, 100% accent, 55% accent-800,
  │     │     85% accent-700, 30% neutral-800, 20% neutral-800
  │     └ caption row (10px neutral-600, uppercase .06em, mt 6):
  │            left label | right label colored --color-ok
  └ .gym-card  [not inside — no tag, no bars]
        ├ row: name flex:1 + ⋮
        ├ meta row: coords | radius
        └ caption row (mt 12): "3 visits" | right label colored --color-danger
  > MFTabs active="gyms"
```

**Text:** `Gyms` · placeholder `Gym name` · `I'm here` · `Smartass Obolon` tag `Inside` · `50.51234, 30.49871` · `radius 150 m` · `Visits · last 7 days` · `11 of 12 logged` (emerald) · `Sportlife Livoberezhna` · `50.45219, 30.60112` · `radius 200 m` · `3 visits` · `2 of 3 logged` (ruby)
_Canvas note:_ "“Inside” is live proximity; the logged ratio is the only place a percentage turns ruby."

## S-47 · Gym · edit radius

```
.phone(relative) > MFStatus > .dimmed ("Gyms" 26px + 150px block)
  ├ .scrim rgba(10,11,13,.6)
  └ .sheet (padding 14px 18px 26px, gap space-4)
       ├ .grabber
       ├ 17px title (mt 4)
       ├ .slider block
       │     ├ row (baseline, space-between): 12px neutral-500 label
       │     │        + 20px tabular value
       │     ├ track height 4 radius 2 background neutral-800 (mt 12, relative)
       │     │     ├ fill width 32% background accent radius 2
       │     │     └ knob 20×20 radius 50% accent at left 32%,
       │     │           box-shadow 0 0 0 4px rgba(217,162,79,0.16)
       │     └ scale row (10px neutral-600, space-between, mt 10)
       ├ .info (flex gap 9, padding 11px 12px, radius md, background var(--color-bg))
       │     └ i.ph-bold.ph-info 15px neutral-500 + 12px/1.5 neutral-500
       └ .actions (flex gap 10): danger-outline "Delete" (+ph-trash)
              | btn-secondary flex:1 | btn-primary flex:1
```

**Text:** `Gyms` · `Smartass Obolon` · `Radius` · `150 m` · `30 m` · `2 000 m` · `Wider catches more visits but also the café next door. 150 m suits most gyms.` · `Delete` · `Cancel` · `Save`

## S-48 · Gym · delete confirm

```
.phone(relative) > MFStatus > .dimmed ("Gyms" + 150px block)
  └ .dialog-scrim rgba(10,11,13,.66) > .dialog
        ├ title row: i.ph-bold.ph-trash 17px danger + 17px
        ├ body 13px/1.55 neutral-400
        └ actions: btn-secondary "Keep" + danger-outline "Delete"
```

**Text:** `Gyms` · `Delete “Smartass Obolon”?` · `12 recorded visits go with it and reminders for this place stop. Your workouts are untouched.` · `Keep` · `Delete`

---

# F · SYSTEM KIT (S-49, S-50) — these two are 540px-wide reference panels, not phones

Panel shell: `background:var(--color-bg); border-radius:var(--radius-lg); padding:22px; box-shadow:var(--shadow-sm); flex column; gap:var(--space-6)`; each group has an 11px `.12em` uppercase neutral-600 label with `margin-bottom:12px`.

## S-49 · Notification kit

**Group 1 label:** `Toasts · 3.2 s, bottom, above the tab bar` — rows `flex; gap:10; padding:12px 14px; radius md`:

1. ok-tint + `ph-check-circle` (ok) → `Gym added · accuracy ±12 m`
2. ok-tint + `ph-trophy` (ok) → `New record · Back Squat 90 kg × 8`
3. danger-tint + `ph-warning-circle` (danger) → `GPS accuracy ±240 m — try again inside`
4. surface + `ph-trash` (danger) → `Set deleted · 8 × 80 kg` + accent `Undo` + neutral-600 tabular `4s`
5. surface + `ph-cloud-check` (ok) → `6 changes synced`

**Group 2 label:** `Banners · persistent, inline, dismissible only when harmless` — rows `padding:11px 13px; radius md`:

1. danger-tint + `inset 3px 0 0 var(--color-danger)` + `ph-cloud-slash` → `Offline · 2 changes queued`
2. surface + `inset 3px 0 0 var(--color-accent)` + `ph-map-pin` → `Unlogged hour at Smartass Obolon` + accent `Log it`
3. surface + `inset 3px 0 0 var(--color-neutral-600)` + `ph-download-simple` (neutral-400) → `A new version is ready — reload to update` + accent `Reload`
4. background `var(--color-accent-900)` + `span.sp` 13×13 → `Syncing 4 / 6` (text `--color-accent-200`)

**Group 3 label:** `Status marks` (12px neutral-400, gap 18, wrap):

- 8×8 ok dot → `Synced`
- `span.sp` 11×11 (neutral-800 ring / accent top) → `Syncing`
- 8×8 danger dot → `Offline / failed`
- 8×8 accent dot → `Live session`
- `tag.tag-neutral` `Queued` · `tag.tag-neutral` `Auto-closed` · `tag.tag-accent` `Inside` · `tag.tag-accent` `Record`

**Rules line (11px neutral-600, line-height 1.6):** `Rules · One toast at a time; a new one replaces the old. Anything reversible gets an undo instead of a dialog. Anything irreversible after sync gets a dialog and no undo. Errors that block the queue stay on screen until resolved.`

## S-50 · Skeleton & loading kit

**Group 1 label:** `Blocks · #262a2d, 6px radius, 1.6 s breathe`

- avatar row: `.sk 44×44 radius 12` + stack of `.sk 40%×13` and `.sk 65%×9`
- `.sk height 62, radius 14`
- three `.sk flex:1 height 70`
- bar row `height 70, align-end, gap 6`: `.sk` at 40/65/50/80/100 %

**Group 2 label:** `Spinners & progress`

- `span.sp` 16×16 and 22×22, `border:2px solid var(--color-neutral-800); border-top-color:var(--color-accent); border-radius:50%`
- determinate bar: track `height 3, radius 2, background var(--color-neutral-900)`, fill `66% var(--color-accent)`; caption `Determinate — queue only` (10px neutral-600)
- `button.btn.btn-primary[disabled]` (40px, 14px, gap 9) with `span.sp` 14×14 → label `Working…`

**Rules line:** `Rules · Under 300 ms show nothing. 300 ms–2 s: skeleton shaped like the real layout. Over 2 s or unknown length: spinner with a label saying what is happening. Never swap a skeleton for a spinner on the same surface — pick one per screen. Content replaces skeletons in place, no cross-fade, no layout jump.`

## Handoff panel (unnumbered, after S-50) — `Handoff · tokens & rules`

**Palette swatch labels:** `bg #16171a` · `surface #1f2125` · `text #e9eaec` · `muted #90959a` · `accent #d9a24f` · `accent tint #342713` · `ok #4cbe8c` · `ok tint #16291f` · `danger #e2564f` · `danger tint #2c1614` · `skeleton #262a2d` · `hairline #3b3f43`

**`Type & metrics`:**
`Inter 400/500 · display 30–40 / −0.025em · title 22 · body 15 · secondary 13 · meta 11–12 · label 10 uppercase 0.12em` / `Numbers always tabular-nums · radius 8 / 14 · tap target ≥ 44 px · session rows 16 px` / `Spacing 5.6 / 8.4 / 11.2 / 16.8 / 22.4 px · phone gutter 18–20 px · card padding 13–16 px`

**`Rules a build must keep`:**

1. `Brass is action and focus; emerald is a result; ruby is loss or failure. Nothing else is coloured.`
2. `Primary buttons are outlined, never filled. Accent never floods a surface.`
3. `Set logging is the ghost row: prefilled from last time, tap a number to nudge, Log commits.`
4. `Reversible → undo snackbar (5 s). Irreversible after sync → dialog naming what is lost and what survives.`
5. `Offline is a state, not an error: local first, queue replays in order, tags stay neutral.`
6. `Every list has empty, skeleton, filled and failed. No screen ships with only the filled one.`

---

# 1. Distinct CSS component classes used across the frames

From the DS stylesheet (`_ds/nocturne-9cf7d899…/styles.css`) plus the two doc-local classes. Values below are with the document's graphite/brass token overrides applied.

| Class                                                                                 | What it looks like                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.btn`                                                                                | `inline-flex`, centered, `gap:6px`, Inter 500 **14px**, `line-height:1.2`, color `#e9eaec`, transparent background, `1px solid transparent` border, `padding:5.6px 10.08px` (`--space-2` / `--space-3 × 1.2`), `border-radius:8px`, `cursor:pointer`. Frames override `min-height` (34–62px) and font-size (13–16px) inline. |
| `.btn:disabled`                                                                       | `opacity:0.45; cursor:not-allowed` — the only disabled treatment in the system.                                                                                                                                                                                                                                              |
| `.btn-primary`                                                                        | Outlined brass: `color:#d9a24f; border-color:#d9a24f`, transparent fill. Hover = accent @12%, active = accent @22%. Never a filled block.                                                                                                                                                                                    |
| `.btn-secondary`                                                                      | Outlined neutral: `border-color:rgba(233,234,236,0.14)`, text `#e9eaec`. Hover = text @7%, active = text @14%.                                                                                                                                                                                                               |
| `.btn-ghost`                                                                          | Accent text-only button, `padding-inline:2.8px` (declared; not used in these frames).                                                                                                                                                                                                                                        |
| `.btn-icon`                                                                           | 36×36, no padding (declared; not used in these frames).                                                                                                                                                                                                                                                                      |
| `.btn-block`                                                                          | full-width + `margin-top:5.6px` (declared; not used).                                                                                                                                                                                                                                                                        |
| `.input`                                                                              | `width:100%; min-height:36px; padding:6px 10px; font-size:14px`, text `#e9eaec`, caret accent, background `#1f2125`, `1px solid rgba(233,234,236,0.14)`, `radius 8px`. Frames raise `min-height` to 40/46/48 and swap `border-color` to `--color-danger` (error) or `--color-accent` (focus/edit).                           |
| `.field > label`                                                                      | 12px label, `margin-bottom:5px`, text @70% (declared; unused in frames).                                                                                                                                                                                                                                                     |
| `.radio`, `.seg`, `.seg-opt`                                                          | DS form controls — **not used** in any of the 50 frames (toggles are hand-rolled 40×24 pill switches).                                                                                                                                                                                                                       |
| `.card` / `.card-kicker` / `.card-title` / `.card-body` / `.card-meta`                | DS card set — **not used**; every card in the frames is an inline-styled `div` (`background:var(--color-surface); border-radius:8px or 14px; padding:13–18px`).                                                                                                                                                              |
| `.tag`                                                                                | `inline-flex`, 11px, `letter-spacing:.02em`, `padding:3px 10px`, `border-radius:6px` (`--radius-md × 0.75`).                                                                                                                                                                                                                 |
| `.tag-accent`                                                                         | `background:#5b4420` (accent-800), text `#fbf3e6` (accent-100). Used for `3 this week`, `Inside`, `+18%`, `+5`, `+2.5`, `Used 6×`, `Record`.                                                                                                                                                                                 |
| `.tag-neutral`                                                                        | `background:#3b3f43` (neutral-800), text `#f5f6f7` (neutral-100). Used for `Auto-closed`, `Queued`, `3 sets`, `Used 4×`, `Used 5×`.                                                                                                                                                                                          |
| `.tag-outline` / `.tag-accent-2`                                                      | Declared; unused in these frames.                                                                                                                                                                                                                                                                                            |
| `.table`                                                                              | `width:100%; border-collapse:collapse; font-size:14px`. `th` = 11px `.08em` uppercase, text @60%, `padding:5.6px`. `td` = `padding:5.6px`. Row rules are painted as row-level gradient strips that fade out in the first/last 48px; `tbody tr:hover` adds a text @4% tint. Used only in S-32 and S-33.                       |
| `.elev-sm/-md/-lg`                                                                    | Shorthands for the three shadows (phones use `var(--shadow-md)` directly).                                                                                                                                                                                                                                                   |
| `.dialog-backdrop` / `.dialog` / `.dialog-title` / `.dialog-body` / `.dialog-actions` | DS dialog set — **not used**; the frames hand-roll the same shape inline (scrim `rgba(10,11,13,0.66)`, card `surface / radius 14 / padding 18 / shadow-lg`, title 17px, body 13px neutral-400, actions right-aligned gap 10).                                                                                                |
| `.hr`                                                                                 | 1px rule that fades to transparent in the outer 48px (used for the canvas section dividers, not inside phones).                                                                                                                                                                                                              |
| `.nav`, `.nav-brand`                                                                  | Declared; unused (the app uses `MFTabs`).                                                                                                                                                                                                                                                                                    |
| **`.sk`** _(doc-local)_                                                               | Skeleton block: `background:#262a2d; border-radius:6px; animation: shimmer 1.6s ease-in-out infinite` (opacity .35 → .7 → .35). Sizes always set inline; large blocks override `border-radius:14px`. 56 instances.                                                                                                           |
| **`.sp`** _(doc-local)_                                                               | Spinner: `animation: spin 1s linear infinite`; always paired with inline `width/height`, `border:2px solid <ring>`, `border-top-color:var(--color-accent)`, `border-radius:50%`. Ring is `--color-neutral-800` on neutral surfaces and `--color-accent-800` inside brass buttons/banners.                                    |

**Recurring inline "components" that deserve real classes in a rebuild:** phone frame, session top bar, set-table grid (`18px 1fr 1fr 62px`), exercise card, ghost row, stat strip, stat grid (3-up), section label (11px/.12em/uppercase/neutral-600), recent row, banner (3px inset rail: accent / danger / neutral-600), tinted callout (1px inset ring: danger-line / ok-line), toast, undo snackbar, bottom sheet + grabber, dialog + scrim, menu item, danger-outline button, pill switch (40×24), slider (4px track + 20px knob with 4px accent glow ring), progress bar (3px), week strip, bar chart (heights + accent ramp), sparkline SVG.

# 2. Bottom tab bar and top bar patterns

**Tab bar** (`MFTabs`, 78px, only on S-07, S-08, S-10–S-16, S-34–S-38, S-41–S-46):
`ph-house` `Today` · `ph-chart-line-up` `Progress` · `ph-map-pin` `Gyms` · `ph-squares-four` `Apps`; icons 20px bold, labels 10px, active `#d9a24f`, inactive `#71767b`, hairline top rule `0 -1px 0 rgba(233,234,236,0.14)`, background `#16171a`, bottom padding 22px (home-indicator inset).
Frames with sheets, dialogs or a live-session context (S-01–S-06, S-09, S-17–S-33, S-39, S-40, S-47, S-48) render **no** tab bar.

**Top bar patterns:**

1. **Status bar only** (`MFStatus`, all frames): `9:41` + signal/wifi/battery fill icons.
2. **Big-title header** (Today, Progress, Gyms, Templates, Exercise history): kicker (11px/.12em/uppercase/neutral-600) over a 26–30px `-0.025em` title, optionally with a right-side sync chip (dot or spinner + 11px label: `Synced` / `Syncing` / `Offline` / `Failed`). Some (Templates, Exercise history) prepend `ph-caret-left` at 19px `margin-left:-6px`.
3. **Session bar** (S-17, S-19–S-23, S-26, S-27, S-30): `ph-caret-left` (20px, fixed 36px slot) + centre stack (accent kicker `In session · <gym>` / `In session`, or neutral kicker `Closed automatically`, `Mon 27 July · 08:40 → 09:34`) + right action (`Finish`, `Reopen`, or a ruby `ph-trash`). Clock is 22px tabular-nums.
4. **Screen title + inline action** (Services): 22px `Services` left, 13px accent `Sign out` right.

# 3. Phosphor icons used (`@phosphor-icons/web@2.1.1`)

**Weights loaded:** regular, bold, fill stylesheets. Frames use `ph-bold` almost exclusively; `ph-fill` appears in `MFStatus` and once in S-29.

**In the 50 frames (`ph-bold` unless noted):**
`ph-arrow-clockwise`, `ph-arrow-counter-clockwise`, `ph-arrow-right`, `ph-arrow-up-right`, `ph-arrows-clockwise`, `ph-arrows-down-up`, `ph-barbell`, `ph-cards`, `ph-caret-left`, `ph-caret-right`, `ph-carrot`, `ph-chart-line`, `ph-chart-line-up`, `ph-check-circle` (also `ph-fill ph-check-circle` in S-29), `ph-clock-countdown`, `ph-cloud-check`, `ph-cloud-slash`, `ph-copy`, `ph-crosshair`, `ph-dots-three-vertical`, `ph-download-simple`, `ph-eraser`, `ph-flame`, `ph-info`, `ph-list-plus`, `ph-magnifying-glass`, `ph-map-pin`, `ph-map-pin-slash`, `ph-pencil-simple`, `ph-play`, `ph-plus`, `ph-robot`, `ph-shield-check`, `ph-timer`, `ph-trash`, `ph-trophy`, `ph-warning-circle`, `ph-warning-octagon`

**In the imported components:** `ph-fill ph-cell-signal-high`, `ph-fill ph-wifi-high`, `ph-fill ph-battery-high` (MFStatus); `ph-bold ph-house`, `ph-bold ph-chart-line-up`, `ph-bold ph-map-pin`, `ph-bold ph-squares-four` (MFTabs).

**Typical sizes:** 12–13px inline chevrons/arrows · 14–17px in banners, toasts, dialogs, buttons · 18px in action-sheet menu items and session back arrow · 20px tab icons and the S-29 check · 22px service tile glyphs · 26px empty-state glyphs (always `--color-neutral-700`) · 28px auth wordmark barbell (accent).
