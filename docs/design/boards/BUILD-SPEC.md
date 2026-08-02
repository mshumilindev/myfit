# My Fit — build spec

Design source of truth for implementation. Read this with `ACCEPTANCE-CRITERIA.md` (testable ACs) beside it.

| File | What it is |
| --- | --- |
| `My Fit - Graphite.dc.html` | Clickable prototype — phone + desktop, real interactions |
| `My Fit - All States.dc.html` | Mobile state inventory, 50 frames, ids **S-01 … S-50** |
| `My Fit - All States Web.dc.html` | Web state inventory, 13 frames, ids **W-01 … W-13** |
| `My Fit - Gyms and Live Session.dc.html` | Gym discovery, imagery, live hero — **G-01 … G-12** (phone), **GW-01 … GW-06** (web) |
| `My Fit - Onboarding and Roles.dc.html` | Stepped sign-up, avatars, admin & trainer — **O-01 … O-10**, **AD-01 … AD-07**, **TR-01 … TR-04** |
| `Current UI recreation.dc.html` | Faithful recreation of today's UI, for before/after |

Superseded explorations kept for reference: `Variant A - Tabs`, `Variant B - Sheet`, `Variant C - Hub`.

## Concept

Multi-user product (accounts, sign-up open, server sync), offline-first client. Shell = auth + sync + services registry; Training is service #1. Copy voice: plain, factual, no exclamation marks, numbers over adjectives.

## Tokens

```
bg           #16171a      surface      #1f2125      hairline  #3b3f43
text         #e9eaec      muted        #90959a      dim       #71767b
accent       #d9a24f      accent tint  #342713      accent-300 #eed3a5
ok           #4cbe8c      ok tint      #16291f      ok text   #b7e8cf
danger       #e2564f      danger tint  #2c1614      danger text #f3c2bf
skeleton     #262a2d
```

Type: Inter 400/500. Display 30–40 / −0.025em · title 22 · body 15 · secondary 13 · meta 11–12 · label 10 uppercase 0.12em. All numbers `tabular-nums`.
Metrics: radius 8 / 14 · tap target ≥ 44 px · phone gutter 18–20 px · card padding 13–16 px · spacing 5.6 / 8.4 / 11.2 / 16.8 / 22.4.

## Colour rules

1. Brass = action, focus, live session. Outlined buttons only — accent never fills a surface.
2. Emerald = success, records, healthy sync.
3. Ruby = destructive, failure, offline.
4. Everything else graphite. Queued / auto-closed states use neutral tags, not ruby.

## Interaction rules

- **Set logging** is the ghost row: prefilled from last time, tap a number to nudge (phone) / type + Enter (desktop), Log commits and renumbers.
- **Reversible** (set deleted, exercise deleted, template deleted) → undo snackbar, 5 s, no dialog.
- **Irreversible after sync** (whole workout, gym, sign-out with queue) → dialog naming what is lost *and* what survives. No undo.
- **Deleting an exercise that holds sets** → dialog + undo. Empty exercise → straight delete + undo.
- **Loading**: < 300 ms nothing · 300 ms–2 s skeleton shaped like the real layout · > 2 s or unknown spinner with a label. One or the other per surface, never both.
- **Offline** is a state, not an error: local write first, queue replays in order, only a blocked queue gets a persistent card with the raw reason + Retry / Discard.
- **8-hour rule**: open session auto-closes at start + 8 h, marked brass (rule fired as designed), reopenable.

---

# Update 1 — Gym discovery and imagery

**Problem it solves.** Today a gym is a name the user types plus a GPS pin. Nothing identifies the place visually, and a gym that isn't in any database is the same amount of work as one that is.

**What changes.** Adding a gym becomes a search across several providers, with a Google image search as the photo fallback and a locally generated house graphic as the final fallback. Every gym therefore always has an image, and the app never shows a broken or empty picture frame.

### Resolution order (venue)

1. **Local DB** — gyms this account already saved (exact + fuzzy name match).
2. **OpenStreetMap** (Overpass, `leisure=fitness_centre`, `amenity=gym`) — radius query around the user.
3. **Google Places** — Text Search + Nearby Search.
4. **Foursquare Places** — category `Gym / Fitness Center`.

Providers are queried **in parallel**, results stream in as each answers, and identical venues are **merged into one row** (same row shows every source that contributed). Provider chips are the loading indicator — each turns emerald with its result count.

### Resolution order (photo)

1. Photo attached to the merged venue record (Places photo ref / OSM `image` tag / Foursquare photo).
2. **Google Images** search — query `"<gym name> gym <city>"`, results filtered to ≥ 600 px on the shorter side; the user picks.
3. **House graphic** — graphite weave (`repeating-linear-gradient` 135°, 3.5% white, 2 px / 11 px) over `#23262a → #1a1c20`, centred barbell mark at `--color-neutral-700`. Generated locally at any size, no network.

The house graphic is a **valid final state**, never labelled "missing", and is offered as a first-class button in the picker, not a link.

### Storage & privacy

Chosen image is fetched **once**, downscaled to max 1600 px on the long edge, re-encoded, and cached on the user's own hub (`/media/gyms/<gymId>.<ext>`). Never hot-linked at render time, never sent anywhere else, replaceable from the gym menu. The record keeps `photoSource` (`places | osm | foursquare | google-images | manual | generic`) and `photoCachedAt`, both shown in the UI.

### Image sizes (the only four)

| Slot | Size | Where |
| --- | --- | --- |
| Pane header | 320 px tall, full pane width | GW-01 |
| Hero | 210 / 150 / 60 px (web), 148 / 126 / 52 px (phone) | G-08…G-12, GW-03…GW-06 |
| Card | 120 px tall | G-07, GW-03 |
| Row thumb | 64 × 64 (phone), 72 × 56 (web) | G-01, G-02, GW-01 |

Every photo carries a bottom-up scrim (`linear-gradient` to `rgba(22,23,26,0.94)`) so any picture keeps text at ≥ 4.5:1.

### Manual add

Zero results is a fork, not a dead end: the manual form appears **pre-filled** with the typed name and the current GPS fix, with "Find a photo on Google" as the primary action. Desktop location is IP-based (±2 km) — desktop tells the user to pick from the list or add from the phone, and does not offer "pin here".

### Frames

`G-01` nearby · `G-02` streaming · `G-03` no results → manual · `G-04` image picker · `G-05` image search failed · `G-06` gym detail · `G-07` list with imagery · `GW-01` two-pane search · `GW-02` desktop picker with dimensions.

---

# Update 2 — The live-session hero

**Problem it solves.** An open session was a card among cards. It was possible to be mid-workout and not see it — and after the imagery update, a session had no visual identity at all.

**What changes.** While a session is open, a photographic band of the gym you are in is mounted **above the router outlet** on every screen, phone and desktop. It is the only element in the product allowed to run a photograph edge to edge, which is what makes "live" unmistakable.

### Geometry

| Context | Phone | Web |
| --- | --- | --- |
| Own screen (Today), unscrolled | 148 px | 210 px |
| Inside the session | 126 px | 150 px |
| Other screens / scrolled | 52 px | 60 px |
| Menu-bar popover | — | 110 px |

Expanded → collapsed is a **height transition, 180 ms `ease-out`**, driven by scroll position. The photograph itself never cross-fades. Collapse threshold: 64 px of scroll.

### Anatomy

- Background: cached gym photo (or house graphic), `background-size: cover`, `background-position: center`.
- Scrim: bottom-up gradient to 94% when tall, left-to-right 92% → 62% when collapsed.
- Live chip: pulsing brass dot (2.6 s) + `Live · <gym name>`, uppercase 10 px / 0.1em.
- Timer: 40 px (phone expanded) / 56 px (web expanded) / 15–20 px (collapsed), `tabular-nums`.
- Stats: sets, tonnage, exercise count — meta size, brass-neutral.
- Action: `Resume` (outlined, on a 45–50% dark plate so it reads on any photo).
- **Brass hairline**, 1 px, gradient to transparent, always present under the band. It — not the photo — is the constant signal.

### States

| State | Change |
| --- | --- |
| Live | Brass pulsing dot, brass hairline |
| Resting | Band tints to `rgba(52,39,19,.92)`, timer takes the number, `Skip` appears |
| Offline while live | Dot and hairline turn ruby, label `Live · offline · N queued`; photo stays |
| Photo loading | Skeleton band at the same height — never a height jump |
| Unknown location | House graphic + prompt card below to attach a place; the session is never blocked |
| Auto-closed (8 h) | Dot turns graphite, label `Closed automatically`, `Reopen` replaces `Resume` |

### Consequences elsewhere

- Today's "Start session" button is **removed** while live — the hero is the action.
- Today's own headline drops from 30 px to 26 px so the band stays the loudest thing.
- The rail (web) carries a brass dot on the Today icon, so the state survives even in a 400 px window.
- The gym you are standing in gets a brass hairline and a `You're here` chip in the gym list — same language as the hero.

### Frames

`G-08` Today expanded · `G-09` collapsed strip · `G-10` in-session header · `G-11` unknown place · `G-12` anatomy of all five states · `GW-03` web Today · `GW-04` web session · `GW-05` web collapsed · `GW-06` narrow window + tray popover + imagery rules.

---

## Screen map

**Mobile (S-xx)** — Auth 01–06 · Shell & Today 07–16 · Session 17–29 · History / Progress / Templates 30–40 · Gyms 41–48 · Notification kit 49 · Skeleton kit 50.
**Web (W-xx)** — Auth 01–02 · Today 03–05 · Session 06–09 · History 10 · Progress 11 · Gyms 12 · Tray / narrow / shortcuts 13.
**Gyms & hero** — phone G-01…G-12 · web GW-01…GW-06.
**Onboarding & roles** — onboarding O-01…O-10 · admin AD-01…AD-07 · trainer TR-01…TR-04.

## Desktop specifics

Rail replaces the tab bar (account chip at its foot). No keyboard shortcuts anywhere — every action is reachable by pointer alone. Right-click opens the same menu the ⋮ carries. Double-click a logged set edits it in place. Hover = 4% text tint; focus ring 2 px brass, offset 2. Under 720 px the rail collapses to a hamburger and the layout matches the phone.

---

# Update 3 — Stepped sign-up

**Problem it solves.** A single account form told a new person nothing and left them on an empty dashboard.

**What changes.** Sign-up becomes four full-screen steps — identity, avatar, gym, first set — ending inside a live session rather than on a welcome page. A four-bar progress rail is present from the invite screen onwards. Steps 2 and 3 are skippable; step 1 is not; no step blocks on a device permission. Every step persists on blur, so an abandoned flow resumes where it stopped. Step 3 reuses the entire gym-discovery stack from Update 1.

**Avatars.** Circle-mask crop over the raw frame, upload runs while the user adjusts, downscale to 512 px before leaving the device, ≤ 10 MB accepted. Skipping yields initials on a graphite disc — stated explicitly, never a surprise.

**Frames** — `O-01` invite landing · `O-02` identity · `O-03` avatar · `O-04` crop + upload · `O-05` gym · `O-06` ready · `O-07` live session · `O-08` link dead · `O-09` step errors · `O-10` member profile.

---

# Update 4 — Admin and trainer roles

**Problem it solves.** The product assumed one person. It now has a coach who needs to see clients, and an owner who needs to create them.

**Roles.** *Member* — own data, read/write. *Trainer* — read-only on assigned clients, may assign programs and write private notes. *Admin* — everything a trainer sees for everyone, plus people, invite links, assignments and roles. Members never see each other.

**Invite links.** Admin creates the account (name, email, trainer) and gets a single-use link valid 7 days, with copy and QR. The link carries no password — the claimant sets their own. States: sent, expired, revoked, claimed, re-requested.

**Hard rules.** Nobody but the owner ever writes a logged set — not a trainer, not an admin. Revoking an assignment kills access on the next request, not the next login. Every read of another person's data is written to an audit log the member can open. Admin writes are the one part of the product that is *not* offline-first — identity cannot be reconciled after the fact, so the UI refuses instead of queueing. Deleting a person requires typing their name.

**Frames** — `AD-01` people · `AD-02` create + link · `AD-03` member detail · `AD-04` assign trainer · `AD-05` invite states + delete · `AD-06` empty/skeleton/failed · `AD-07` permission matrix · `TR-01` clients · `TR-02` client detail · `TR-03` denied states · `TR-04` trainer phone.

---

## New vs today's app

Added: templates / repeat session · previous-weight ghost values · progress charts · rest timer · session summary with PR comparison · full empty/skeleton/error coverage · undo everywhere reversible · **multi-provider gym search** · **gym imagery with Google fallback and house graphic** · **live-session hero on every screen** · **stepped sign-up ending in a session** · **avatars** · **admin and trainer roles with invite links**.
