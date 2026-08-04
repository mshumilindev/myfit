# My Fit — acceptance criteria

Exhaustive, testable criteria for every feature in the design. Format `AC-<AREA>-<n>`; frame ids in brackets point at the design boards. **MUST** is a hard requirement, **MUST NOT** a prohibition. Timings are wall-clock on a mid-range phone over a normal connection.

Areas: AUTH · ONB · AVATAR · ROLE · ADMIN · INVITE · TRAINER · SEARCH · IMG · HERO · SESSION · SET · EXERCISE · WORKOUT · TEMPLATE · PROGRESS · GYM · SYNC · UI

---

## 1 · Authentication — `AC-AUTH`

**AC-AUTH-01 [S-01]** With no token present the app MUST open the sign-in screen and MUST NOT flash any authenticated surface first.

**AC-AUTH-02 [S-02]** A 401 from `POST /api/auth/login` MUST render the message under the password field with a ruby border on that field. It MUST NOT be a toast or a dialog, and MUST NOT reveal which of the two fields was wrong.

**AC-AUTH-03 [S-03]** If `/api/auth/status` is unreachable, both inputs and the submit MUST drop to 45% opacity and be non-interactive, and a Retry MUST appear. The copy MUST say the first sign-in requires a connection.

**AC-AUTH-04 [S-04]** While a login request is in flight the button MUST show a spinner in place of its label, MUST keep its exact height, and MUST reject repeat submits.

**AC-AUTH-05 [S-01, S-02]** Auth screens MUST be vertically centred on phone at every supported height from 667 px to 932 px, with no clipping.

**AC-AUTH-06 [S-06]** Field validation MUST run on blur, not on keypress. The submit MUST stay disabled until every field passes.

**AC-AUTH-07** Password minimum is 6 characters, enforced client- and server-side with the same message.

**AC-AUTH-08 [W-01]** On web the focus ring MUST be 2 px brass at offset 2, and tab order MUST be username → password → submit.

**AC-AUTH-09** Signing out with a non-empty sync queue MUST show a dialog stating the queued count; confirming discards the queue. [S-09]

---

## 2 · Onboarding — `AC-ONB`

**AC-ONB-01 [O-01]** Opening a valid invite link MUST show the inviting admin's name and avatar before any form. An unattributed invite is a defect.

**AC-ONB-02 [O-01…O-06]** The flow MUST be exactly four steps with a persistent four-bar rail showing the current index; the rail MUST be identical in geometry on every step.

**AC-ONB-03 [O-02]** For an invited user, name and email MUST be prefilled from the admin's record and MUST remain editable. For self-serve sign-up the same screen renders empty.

**AC-ONB-04** Step 1 MUST be mandatory. Steps 2 and 3 MUST each offer an explicit skip that names its consequence ("use my initials", "I'll add it later").

**AC-ONB-05** No step may block on a device permission. If geolocation is refused at step 3 the user MUST be able to search by name or skip. [O-09]

**AC-ONB-06** Every step MUST persist its input on blur. Closing and reopening the app MUST resume at the furthest completed step with all prior input intact. [O-09]

**AC-ONB-07** Back MUST be available on steps 2–4 and MUST NOT discard input on any step.

**AC-ONB-08 [O-06]** The final step MUST offer "Start training now" as the primary action; choosing it MUST create a workout and land the user in the live session — not on Today. [O-07]

**AC-ONB-09 [O-06]** If a gym was picked at step 3 and the user is inside its radius, the final step MUST use that gym's photograph as the full-screen ground and name the gym in the copy.

**AC-ONB-10 [O-07]** A session started from onboarding MUST already carry the hero with the chosen gym's image, with no intermediate empty state.

**AC-ONB-11 [O-08]** An expired, revoked or already-claimed link MUST show which rule was hit, the relevant date, and a "request a new link" action that notifies the admin in-product (no email round-trip).

**AC-ONB-12 [O-09]** A duplicate email MUST fail inline on the field with an offer to sign in instead. It MUST NOT create a partial account.

**AC-ONB-13** Total time from opening the link to the first logged set MUST be achievable in under two minutes with no optional steps completed.

**AC-ONB-14** Onboarding MUST NOT use dialogs. All errors are inline or banner. [O-09]

---

## 3 · Avatars — `AC-AVATAR`

**AC-AVATAR-01 [O-03]** Both camera capture and library pick MUST be offered as equal-weight buttons.

**AC-AVATAR-02 [O-04]** Cropping MUST be a circular mask over the uncropped frame with a zoom control. The output MUST be a square image.

**AC-AVATAR-03 [O-04]** The image MUST be downscaled to 512 px on the long edge **on the device**, before upload. The original MUST NOT be transmitted.

**AC-AVATAR-04 [O-04]** Upload MUST begin while the user is still adjusting, so confirming is perceptually instant. Cancelling MUST abort the in-flight upload.

**AC-AVATAR-05 [O-09]** Files over 10 MB MUST be rejected before upload with a message stating the actual size and the limit.

**AC-AVATAR-06** Accepted types: JPEG, PNG, HEIC, WebP. Anything else MUST be rejected with a plain-language message.

**AC-AVATAR-07** Absent an avatar the app MUST render the person's initials on a graphite disc at every size. It MUST NOT render a broken image, a silhouette placeholder, or an empty circle.

**AC-AVATAR-08** Avatars MUST render at exactly four sizes: 150 px (onboarding), 76 px (profile), 34–40 px (rows, cards, rail), 30–32 px (table cells).

**AC-AVATAR-09** Avatars are stored on the user's own hub and are visible only to the owner, their admin and their assigned trainer. [O-10]

**AC-AVATAR-10** Replacing an avatar MUST delete the previous file after the new one is written.

---

## 4 · Roles & authorisation — `AC-ROLE`

**AC-ROLE-01 [AD-07]** Three roles exist: member, trainer, admin. Every API route MUST be guarded by the AD-07 matrix, enforced server-side; UI hiding alone is not compliance.

**AC-ROLE-02** A member MUST be able to read and write only their own data, and MUST NOT be able to enumerate, search or view any other person.

**AC-ROLE-03** A trainer MUST be able to read sessions, progress, records, programs and gyms of **assigned clients only**. Requesting an unassigned member MUST return 403. [TR-03]

**AC-ROLE-04** An admin MUST be able to read every member's data and MUST be the only role able to create, edit, delete or suspend people, generate or revoke invites, and assign trainers or roles.

**AC-ROLE-05** **No role other than the owner may write a logged set.** Trainer and admin write access to sets MUST NOT exist at the API level. [AD-07]

**AC-ROLE-06** A trainer MAY assign programs to their clients and write notes. An admin MAY do the same for anyone.

**AC-ROLE-07** Revoking an assignment or a role MUST take effect on the **next request**, not at next login. An open tab MUST lose the data on its next poll and show the denied state. [TR-03]

**AC-ROLE-08** Every read of another person's data MUST be written to an audit log recording reader, subject, resource and timestamp. The subject MUST be able to open that log from their own profile.

**AC-ROLE-09 [O-10]** A member's profile MUST list exactly who can read their data, by name and role. Access that is not listed there MUST NOT exist.

**AC-ROLE-10** Role changes MUST notify both the affected person and, for assignments, the trainer. [AD-04]

**AC-ROLE-11** A member MUST have at most one assigned trainer. Assigning a second replaces the first and revokes the first's access atomically.

---

## 5 · Admin — `AC-ADMIN`

**AC-ADMIN-01 [AD-01]** The people table MUST show, per person: avatar, name, email, role, assigned trainer, last session, 30-day volume and status. Sortable by any column.

**AC-ADMIN-02 [AD-01]** A member with an open session MUST show a pulsing brass dot and "Training now" in the status column, updating without a manual refresh.

**AC-ADMIN-03 [AD-01]** Status values MUST be exactly: Training now · Active · Dormant · N d · Invite sent · N d left · Invite expired · Invite revoked · Suspended.

**AC-ADMIN-04 [AD-01]** Filters MUST cover All / Members / Trainers / Pending, and search MUST match name and email substrings.

**AC-ADMIN-05 [AD-02]** Creating a member MUST take name, email and optional trainer, and MUST return the invite link in the same dialog — never on a separate screen.

**AC-ADMIN-06 [AD-02]** The admin MUST NOT be able to set or view a member's password at any point.

**AC-ADMIN-07 [AD-03]** The member detail view MUST present the same charts, records and session table the member sees, plus account controls. Tabs: Overview, Sessions, Programs, Gyms, Account.

**AC-ADMIN-08 [AD-03]** When the member is mid-session, the detail header MUST show the live chip with the running elapsed time.

**AC-ADMIN-09 [AD-05]** The member menu MUST contain: open profile, change trainer, edit name & email, send password reset, export their data, suspend access, delete member. Destructive items MUST sit below a rule.

**AC-ADMIN-10 [AD-05]** Deleting a person MUST require typing their full name exactly; the confirm button stays disabled until it matches. The dialog MUST state sessions, tonnage and record counts that will be destroyed, and that the trainer loses access at the same moment. There is no undo.

**AC-ADMIN-11** Suspending MUST block sign-in while preserving all data, and MUST be reversible in one action.

**AC-ADMIN-12 [AD-06]** Admin writes MUST NOT be queued offline. When the server is unreachable the UI MUST say so and refuse the action rather than accept it locally.

**AC-ADMIN-13 [AD-06]** A duplicate-email failure MUST name the existing account holder and show the raw status (`409 · POST /api/admin/users`).

**AC-ADMIN-14 [AD-06]** The people list MUST have empty, skeleton and failed states; the empty state MUST offer creating the first member.

**AC-ADMIN-15** Exporting a member's data MUST produce a machine-readable file of every session, set, gym and record for that member only.

---

## 6 · Invite links — `AC-INVITE`

**AC-INVITE-01 [AD-02]** A link MUST be single-use and MUST expire 7 days after creation; both facts MUST be visible in the dialog that produces it.

**AC-INVITE-02** The token MUST be cryptographically random, at least 96 bits, and MUST NOT encode the email, the user id or any password.

**AC-INVITE-03 [AD-02]** The dialog MUST offer copy-to-clipboard and a QR rendering of the same URL.

**AC-INVITE-04** Until claimed, the account MUST hold only name, email and assigned trainer — no sessions, no credentials, and MUST NOT be able to sign in.

**AC-INVITE-05 [AD-05]** Invite states MUST be distinguishable in the people table: sent (with days remaining), expired, revoked, claimed (with date), re-requested.

**AC-INVITE-06** Revoking MUST invalidate the token immediately; a subsequent open MUST show the dead-link screen. [O-08]

**AC-INVITE-07** Issuing a new link MUST invalidate any previous outstanding link for that account.

**AC-INVITE-08** Claiming MUST bind the data to the pre-created account id — a new id MUST NOT be created.

**AC-INVITE-09** A member requesting a new link MUST surface as an actionable row in the admin's people list within one poll interval. [AD-05]

---

## 7 · Trainer — `AC-TRAINER`

**AC-TRAINER-01 [TR-01]** The trainer home MUST show only assigned clients, as cards, with per-client last-seen and weekly volume.

**AC-TRAINER-02 [TR-01]** A client mid-session MUST show the live chip with elapsed time and current session summary.

**AC-TRAINER-03 [TR-01]** Dormant clients (no session for 30+ days) MUST be surfaced in ruby, in both card and table.

**AC-TRAINER-04 [TR-02]** Client detail MUST carry a permanent emerald read-only bar naming the relationship and stating the client can see the visit.

**AC-TRAINER-05 [TR-02]** Write affordances MUST be **absent**, not disabled: no edit, delete, account or set controls may render on any trainer surface.

**AC-TRAINER-06 [TR-02]** A client's live session MUST update in the trainer's view without a manual refresh, including new sets and records.

**AC-TRAINER-07 [TR-02]** Trainer notes MUST be visible to the trainer and the client, and to no one else except an admin.

**AC-TRAINER-08 [TR-03]** Losing access mid-view MUST clear the data from the screen immediately and explain who changed what and when — not leave stale data until reload.

**AC-TRAINER-09 [TR-03]** The trainer empty state MUST explain that assignment is the admin's decision and requires no action from the trainer.

**AC-TRAINER-10 [TR-04]** The trainer phone app MUST have three tabs — Clients, Programs, Me — and MUST NOT show Today or Gyms, because a trainer account logs nothing of its own.

**AC-TRAINER-11** A trainer MUST NOT be able to search for, enumerate, or deep-link to any member who is not their client.

---

## 8 · Gym search — `AC-SEARCH`

**AC-SEARCH-01 [G-01]** Opening "Add a gym" MUST issue exactly one geolocation read (`enableHighAccuracy: true`, `timeout: 8000`) and MUST render nearby results before the user types.

**AC-SEARCH-02 [G-02, GW-01]** All four providers (local DB, OpenStreetMap, Google Places, Foursquare) MUST be queried in parallel. Time to first rendered result MUST NOT exceed the fastest provider's latency + 150 ms.

**AC-SEARCH-03 [G-02]** Each provider MUST have a chip with three states: pending (spinner), answered (emerald check + count), failed (graphite, `—`, reason). A failed provider MUST NOT block the others.

**AC-SEARCH-04 [G-02]** Results MUST stream as each provider answers. Rendered rows MUST NOT reorder except to merge a duplicate.

**AC-SEARCH-05 [G-02]** Two results MUST merge into one row when coordinates are within 60 m **and** normalised names have Levenshtein distance ≤ 2, or when they share a linked external id. The merged row MUST list every contributing source.

**AC-SEARCH-06** Typing MUST debounce at 350 ms; a new query MUST abort in-flight requests and discard late responses.

**AC-SEARCH-07 [G-02]** Between 300 ms and the first result the list MUST show skeleton rows matching real row geometry. No spinner may appear in the list body.

**AC-SEARCH-08 [G-03]** Zero results across all providers MUST show each provider at `· 0` and render the manual form prefilled with the typed string and the current fix with its accuracy.

**AC-SEARCH-09 [GW-01]** On desktop, location is IP-derived; the UI MUST state ±2 km, MUST NOT offer "Pin here", and MUST suggest adding from the phone.

**AC-SEARCH-10** Provider failures MUST be logged with name, status and duration, and MUST NOT surface as a toast or dialog.

**AC-SEARCH-11** Results MUST be cached per (query, 100 m-rounded location) for 24 h so search degrades gracefully offline.

---

## 9 · Gym imagery — `AC-IMG`

**AC-IMG-01 [G-01]** Photo resolution order MUST be: venue-attached photo → Google Images → house graphic, stopping at the first hit.

**AC-IMG-02 [G-04, GW-02]** Google Images candidates MUST be filtered to ≥ 600 px on the shorter side, capped at 8. Desktop MUST show each candidate's pixel dimensions.

**AC-IMG-03 [G-04, GW-02]** The house graphic MUST be an equal-weight option in the picker — a button on phone, the last tile on desktop — never a text link.

**AC-IMG-04 [G-05]** If nothing passes the filter, the failure state MUST render the house graphic at real size with "Take one now" and "Keep graphic". It MUST NOT fall back silently.

**AC-IMG-05** The chosen image MUST be fetched once, downscaled to ≤ 1600 px long edge, re-encoded (WebP q80, JPEG fallback) and cached at `/media/gyms/<gymId>.<ext>`. It MUST NOT be hot-linked at render time.

**AC-IMG-06 [G-06]** The record MUST persist `photoSource ∈ {places, osm, foursquare, google-images, manual, generic}` and `photoCachedAt`; both MUST be visible with a Replace action.

**AC-IMG-07** The house graphic MUST be generated locally with no network and MUST render correctly from 64 px to 320 px. It MUST NOT be labelled "missing".

**AC-IMG-08** Photos MUST appear at exactly four slot sizes: 320 px pane header · hero · 120 px card · 64 × 64 / 72 × 56 thumb.

**AC-IMG-09** Every photo behind text MUST carry a scrim reaching `rgba(22,23,26,0.94)` at the text edge; composited contrast ≥ 4.5:1 for body text, ≥ 3:1 for text ≥ 24 px.

**AC-IMG-10** Image load MUST be skeleton → decoded swap in place. CLS contribution MUST be 0.

**AC-IMG-11** A cached image that fails to load MUST fall back to the house graphic in the same frame and re-queue a background re-fetch, with no error toast.

**AC-IMG-12** Replacing a photo MUST delete the previous file after the new one is written and MUST be undoable within the 5 s snackbar.

---

## 10 · Live-session hero — `AC-HERO`

**AC-HERO-01** While `openWorkout != null` the hero MUST be mounted above the router outlet on every screen. There MUST be no route where an open session is invisible.

**AC-HERO-02** Heights MUST be exactly: phone 148 / 126 / 52; web 210 / 150 / 60; popover 110.

**AC-HERO-03** Expanded → collapsed MUST be a 180 ms `ease-out` height transition at 64 px of scroll with 16 px hysteresis. The photograph MUST NOT cross-fade or re-decode.

**AC-HERO-04** The background MUST be the gym's cached photo, or the house graphic when no gym is attached. It MUST NOT be blank at first paint.

**AC-HERO-05** The 1 px hairline MUST be present in every state — brass normally, ruby offline. No state may remove it.

**AC-HERO-06** The live dot pulses on a 2.6 s cycle and MUST render static under `prefers-reduced-motion: reduce`.

**AC-HERO-07** The timer MUST use `tabular-nums`, MUST NOT change width between `09:59` and `10:00`, and MUST tick from the persisted `startedAt` so reloads and backgrounding never restart it.

**AC-HERO-08 [G-12]** Rest state tints the band to `rgba(52,39,19,0.92)`, shows the countdown and a Skip. Returning to logging MUST restore the session timer with no height change.

**AC-HERO-09 [G-12]** Offline turns dot and hairline ruby and the label reads `Live · offline · N queued` with the true queue length. The photograph MUST remain visible.

**AC-HERO-10 [G-11]** With no matching gym the session MUST still start; the hero uses the house graphic and a dismissible card offers Search nearby / Pin here / Not now plus the nearest saved gym and its distance.

**AC-HERO-11** Attaching a gym mid-session MUST swap the image in place and retroactively assign the workout without interrupting the timer or losing sets.

**AC-HERO-12 [G-08]** While live, Today MUST NOT render a Start button and its headline drops to 26 px (phone) / 28 px (web).

**AC-HERO-13 [GW-03]** On web the hero spans the content pane only; the rail MUST carry a brass dot on the Today icon whenever a session is open, including under 720 px.

**AC-HERO-14 [GW-05]** The collapsed web band MUST be sticky — scrolling MUST NOT move or remove it.

**AC-HERO-15** Tapping anywhere in the collapsed band navigates to the session; the Resume hit area MUST be ≥ 44 × 44 px on phone.

**AC-HERO-16** Auto-close at `startedAt + 8 h` MUST turn the dot graphite, relabel to "Closed automatically" and replace Resume with Reopen.

**AC-HERO-17** The hero MUST be the only full-bleed photograph in the product.

---

## 11 · Session & set logging — `AC-SESSION`, `AC-SET`

**AC-SESSION-01 [S-17]** A session with no exercises MUST disable Finish — empty workouts are never recorded.

**AC-SESSION-02 [S-18]** Exercise search MUST match substrings, rank by recency of use, and always offer "Create <query>" as the last row.

**AC-SESSION-03 [S-19]** The session header MUST show elapsed time, set count, tonnage and exercise count, all `tabular-nums`, updating live.

**AC-SESSION-04 [S-27]** A session open for 8 h MUST auto-close at that mark, be labelled brass (rule fired as designed), and be reopenable with the original `startedAt`.

**AC-SESSION-05 [S-28]** Finishing with an exercise that holds no sets MUST warn, naming the exercise that will be dropped and the totals that will be kept. Otherwise Finish is immediate.

**AC-SESSION-06 [S-29]** The summary MUST show duration, sets, tonnage, any new record with its previous best, and a per-exercise comparison against the last comparable session, with gains emerald and drops ruby.

**AC-SET-01 [S-19]** The ghost row MUST be prefilled from the same exercise's last logged set. With no history it MUST be blank, never zero.

**AC-SET-02 [S-19]** Log MUST commit the ghost row, renumber, and present a fresh ghost row prefilled from what was just logged.

**AC-SET-03 [S-20]** Logging a set that beats the stored record MUST tint the row emerald for the rest of the session and raise a PR toast for 3.2 s.

**AC-SET-04 [S-20]** Rest timer MUST start on Log and count down in place inside the hero; Skip dismisses it.

**AC-SET-05 [S-21]** Tapping a logged row MUST open the set editor with steppers (not a keyboard), a warm-up toggle, and Delete positioned away from Save.

**AC-SET-06 [S-22]** Deleting a single set MUST happen with no dialog, MUST renumber remaining sets immediately, and MUST offer a 5 s undo snackbar before the delete enters the sync queue.

**AC-SET-07 [W-08]** On desktop, double-clicking a logged row MUST edit it in place without a modal and without the table reflowing.

**AC-SET-08** Weight accepts one decimal; reps are integers ≥ 1. Invalid input MUST be rejected at the field.

---

## 12 · Exercises, workouts, templates — `AC-EXERCISE`, `AC-WORKOUT`, `AC-TEMPLATE`

**AC-EXERCISE-01 [S-23]** Renaming MUST happen inline, with sets dimmed to 60%, and MUST affect the current session only — history keeps the old name.

**AC-EXERCISE-02 [S-24]** The exercise menu MUST contain rename, duplicate with sets, reorder, open history, clear all sets, delete — with delete alone below a rule.

**AC-EXERCISE-03 [S-25]** Deleting an exercise that holds sets MUST show a dialog listing those sets, then delete with a 5 s undo. An exercise with zero sets MUST delete immediately with undo only.

**AC-EXERCISE-04 [S-26]** Deleting MUST update session totals immediately; undo MUST restore the exercise in its original position.

**AC-EXERCISE-05 [S-32]** Exercise history MUST show record, estimated 1RM, last top set, a 12-week trend and a session table.

**AC-EXERCISE-06 [S-33]** With fewer than three data points the trend MUST be replaced by a statement of what unlocks it. A chart MUST NOT be drawn from one point.

**AC-WORKOUT-01 [S-30]** A past workout MUST be editable with the same rows, menus and ghost row as a live one, minus the clock; additions save to the original date.

**AC-WORKOUT-02 [S-31]** Deleting a whole workout MUST show a dialog naming date, set count and tonnage, and MUST state it cannot be undone. No undo snackbar follows.

**AC-TEMPLATE-01 [S-37]** A template MUST be creatable from any finished session, storing exercises, order and optionally last-used weights.

**AC-TEMPLATE-02 [S-37]** Loading a template MUST create a session with every exercise present and weights prefilled, warm-ups preserved as warm-ups.

**AC-TEMPLATE-03 [S-38]** The empty state MUST offer the most recent session as a concrete candidate, not an abstract "create".

**AC-TEMPLATE-04 [S-40]** Deleting a template MUST use the undo snackbar and MUST NOT touch the sessions it came from.

---

## 13 · Progress & gyms — `AC-PROGRESS`, `AC-GYM`

**AC-PROGRESS-01 [S-35]** Progress MUST show weekly volume, estimated 1RM trends and records. Only the current week takes the full-chroma bar.

**AC-PROGRESS-02 [S-36]** With fewer than three logged sessions, Progress MUST show the unlock state with a dot indicator of how many remain.

**AC-PROGRESS-03 [S-34]** Aggregation MUST render a skeleton matching the real chart geometry, never a spinner.

**AC-GYM-01 [S-41]** "I'm here" MUST stay disabled until a name is entered.

**AC-GYM-02 [S-43]** Blocked location MUST name the exact settings path to fix it and state that only gyms are affected.

**AC-GYM-03 [S-44]** A fix worse than ±100 m MUST warn with the actual accuracy and offer both Retry and Save anyway.

**AC-GYM-04 [S-46]** A gym MUST show live "Inside" proximity, visit count and the logged/total ratio, with the ratio ruby when visits are unlogged.

**AC-GYM-05 [S-47]** Radius MUST be adjustable from 30 m to 2000 m, default 50 m.

**AC-GYM-06 [S-48]** Deleting a gym MUST state the visits lost and explicitly state that workouts are untouched.

**AC-GYM-07** Visit detection runs only while the app is open; this limitation MUST be stated in the UI, not hidden in settings. [S-41]

---

## 14 · Sync & offline — `AC-SYNC`

**AC-SYNC-01** All member-owned writes MUST land in local storage first and succeed regardless of connectivity.

**AC-SYNC-02** The queue MUST replay in creation order. A failure MUST halt the queue rather than skip.

**AC-SYNC-03 [S-14]** Offline MUST be presented as a state with a queued count, using neutral tags on affected records — never ruby error styling on the records themselves.

**AC-SYNC-04 [S-15]** Queue progress MUST be the only determinate progress bar in the product, showing `n / total`.

**AC-SYNC-05 [S-16]** A blocked queue MUST show a persistent card with the plain reason, the raw status line, and both Retry and Discard change.

**AC-SYNC-06** Admin and role writes MUST NOT be queued. [AD-06]

**AC-SYNC-07** The sync indicator MUST have exactly four states: synced (emerald dot), syncing (spinner), offline (ruby dot), failed (ruby dot + card).

---

## 15 · Cross-cutting UI — `AC-UI`

**AC-UI-01** Loading: nothing under 300 ms · skeleton 300 ms–2 s · labelled spinner beyond 2 s or unknown length. One mechanism per surface, never both.

**AC-UI-02** Skeletons MUST mirror the geometry of the content they replace and breathe on a 1.6 s cycle.

**AC-UI-03** Reversible destructive actions MUST use a 5 s undo snackbar. Irreversible-after-sync actions MUST use a dialog naming what is lost and what survives. Deleting a person additionally requires typing the name.

**AC-UI-04** One toast at a time; a new toast replaces the previous. Toasts last 3.2 s, undo snackbars 5 s.

**AC-UI-05** Colour discipline: brass = action, focus, live; emerald = success, records, healthy sync; ruby = destructive, failure, offline. Nothing else is coloured. Primary buttons are outlined; the accent never floods a surface.

**AC-UI-06** Every list surface MUST ship empty, skeleton, filled and failed states.

**AC-UI-07** Tap targets MUST be ≥ 44 × 44 px on phone. All numeric displays MUST use `tabular-nums`.

**AC-UI-08** There MUST be no keyboard shortcuts anywhere in the product; every action MUST be reachable by pointer alone. Right-click on desktop opens the same menu the ⋮ carries.

**AC-UI-09** Hover on desktop is a 4% text tint; focus ring is 2 px brass at offset 2. Browser-default focus styling is a defect.

**AC-UI-10** Under 720 px the desktop rail MUST collapse to a hamburger and the layout MUST match the phone.

**AC-UI-11** Text on any photographic ground MUST meet 4.5:1 for body copy and 3:1 for text ≥ 24 px, measured against the composited background.

**AC-UI-12** Copy MUST state facts and numbers, MUST NOT use exclamation marks, and MUST NOT scold the user for missed sessions or dropped volume.
