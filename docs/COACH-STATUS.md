# Coach dashboard: honest status

Last updated: iteration 25 (2026-10-14), no demo data in the product (earlier text below that mentions fixtures as a runtime mode is history). This is the one page to read before touching Coach: what is real, what is
a fixture, how to switch the backend on, how to run every check, and what is still not proven. The SERVER-SEC and CLIENT agents of
iteration 14 change some rows in parallel; their reports (`iter14-server.md`, `iter14-client.md`) win where they disagree with
this table. (Other Coach docs: `docs/COACH-BACKEND.md` is in Ukrainian and covers deployment; this page is English like `UI-KIT.md`.)

## Real vs fixtures

| Area                            | State                                                                                                                                                               | Where                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Screens (Agenda ... Live)       | Built, 5 locales, Storybook `Pages/Coach/*`, axe + smoke e2e green on test doubles                                                                                  | `client/src/coach/**`                                                 |
| Data behind the screens         | Real adapters only in the app (iteration 25); sample data exists only as test doubles for Vitest / Storybook / the QA build; adapters pass tests on `memoryFs` only | `coach/**/__fixtures__`, `coach/data/firestore/**`                    |
| Crypto (envelopes, keys)        | Real code, unit tested (AAD, padding, key wrap, security code). Never run against a live Firebase project                                                           | `client/src/coachCrypto/**` (barrel `index.ts`)                       |
| Functions (callables, triggers) | Written, tested on the in-memory `Kv` only. Never deployed or run in the emulator                                                                                   | `functions/src/coach/**`, `tests/coach-server/**`                     |
| Firestore rules                 | Written; the logic-level interpreter runs them (`tests/rules/*logic*`), the real emulator has NEVER run (no Java/jar in the sandbox)                                | `firestore.rules`, `tests/rules/**`                                   |
| Program editor tool             | Real, shared by Coach and the athlete app; the runnable `programs/prg-*` doc is created by the plan publish step (plaintext template by design)                     | `client/src/tools/programEditor/**`, `docs/PROGRAM-EDITOR-TOOL.md`    |
| Chat, notes, schedule, live     | Port + fixtures adapter and a real Firestore adapter (sealed); real path unproven end to end                                                                        | `coach/chat`, `coach/notes`, `coach/schedule`, `coach/data/firestore` |

Since iteration 25 there is no demo mode at all: no `fixtures` value, no "Use demo data", no DEMO notice, no sample workspace in the roster, no localStorage
override. Every build (dev, preview, production) runs the real backend and shows the kit error state (with Retry) when it cannot. Sample people exist
only as test doubles in `__fixtures__` directories, reachable through `coach/data/testHooks.ts` from Vitest, Storybook and the QA build.

## How to switch the backend

| `VITE_COACH_BACKEND` | Result                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| unset, `npm run dev` | real backend after a bounded probe; probe failure = error state with the reason and Retry (no demo) |
| unset, prod/preview  | real adapters. Needs deployed functions + rules (COACH-BACKEND section 7)                           |
| `firestore`          | real adapters, without the probe                                                                    |
| `off`                | Coach renders no clients ("not configured")                                                         |
| any other value      | ignored (there is no `fixtures`)                                                                    |

Never mixed: the default ports are "unavailable" stand-ins (they error, they never invent people) and an install that fails shows an error with Retry
(`useCoachBackendStatus`). Deployment steps, secrets (`COACH_PEPPER`, `COACH_SIGNING_KEY`) and the smoke test with two accounts: `docs/COACH-BACKEND.md`.
Screenshots: `client/vite.config.qa.ts` (QA only, never shipped), see COACH-BACKEND section 8.

## How to run the checks

| What                    | Command                                                                           | Notes                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Types                   | `npm run typecheck`                                                               | server, client, desktop                                                                            |
| Lint / format           | `npm run lint`, `npm run format:check`                                            |                                                                                                    |
| Client unit tests       | `cd client && npx vitest run --shard=n/8`                                         | one shard per call in agent sandboxes (shards 3 and 6 are slow, ~170 s)                            |
| Kit + i18n guards       | `npx vitest run tests/kit-guard.test.ts tests/i18n.test.ts`; `npm run i18n:coach` | colours/raw HTML in feature CSS; 5-locale parity of every `coach*` dictionary                      |
| Coach server logic      | `npm run test:coach-server`                                                       | in-memory `Kv`                                                                                     |
| Rules, logic level      | `npx vitest run tests/rules`                                                      | interpreter, no Java; cases needing `FIRESTORE_EMULATOR_HOST` show as skipped                      |
| Rules, real emulator    | `npm run test:rules`                                                              | needs Java 21+ and `@firebase/rules-unit-testing`; see `COACH-BACKEND.md` section 1. Never run yet |
| Coach e2e (smoke + axe) | `npm run e2e:coach` (`e2e:coach:fresh` rebuilds first)                            | below                                                                                              |
| Dead exports            | `npm run deadcode -- coach coachCrypto` (`--all`, `--json`, `--fail`)             | `scripts/unused-exports.mjs`, a knip stand-in that needs no install and little memory              |
| Storybook               | `npm run build-storybook`                                                         | Coach pieces `Coach/<Name>`, pages `Pages/Coach/<Name>`                                            |

### `npm run e2e:coach`

Builds `client/dist-e2e` once with `VITE_COACH_BACKEND=fixtures` (production build, own folder, git- and prettier-ignored), serves it with
`vite preview` on :4174 and runs `tests/e2e/coach-smoke.e2e.ts` and `coach-a11y.e2e.ts` in four projects: `coach-390`, `coach-768`,
`coach-1024`, `coach-1440`. Per Coach route (14 routes): no console errors or page errors, no horizontal overflow, no unnamed buttons /
links; axe-core (WCAG 2 A/AA) must report no `serious` / `critical` rule outside the `KNOWN` list (empty today). The spec signs in a fake
trainer from localStorage (an unsigned JWT with `role: trainer`; the client only reads claims) and aborts every non-localhost request, so
it needs no network and no Firebase. Needs a Playwright Chromium (`npx playwright install chromium`). `E2E_COACH_URL=<url>` skips the
built-in server (serve `client/dist-e2e` yourself). The legacy flows keep their own project: `npm run test:e2e`.

## Known gaps (do not claim these are done)

1. Firestore rules never ran on Google's engine. The interpreter models int vs float, `get()` quotas, list-query provability and
   timestamp types only partly, so every rules case is "passes in the model".
2. No live Firebase run: `firestoreKv`, triggers, `firebaseFs.ts`, `publishPlanVersion` were exercised on in-memory stand-ins only.
3. Real-backend end-to-end (invite, accept, chat, schedule, program send) has never been clicked through in a browser; only the fixtures
   path has (smoke + axe above).
4. Key rotation: after a rotation only documents of the current epoch open; older history shows as unverified until the member's device
   republishes the ring.
5. `liveSessions.expireAt` is an integer in the rules (a TTL policy needs a timestamp).
6. Share extras (activities, weekly sets, trainer days) appear only after the member's device published the derived views.
7. Machine-quality uk / pl / lt / et strings for most Coach dictionaries (not native-reviewed). Ed25519 WebCrypto in old browsers is
   assumed (fails closed).
8. The two chat views (`ThreadView`, `ClientChat`) duplicate about 170 lines; left for the chat owners.
9. Only 1440 / 390 were judged by eye; 768 / 1024 by metrics (e2e overflow + axe), no real phone, no screen reader session.

## Iteration 16: parity client / coach (закрито)

- F2: ключ розмови створюється одразу після accept (idempotent, retry з backoff на клієнті); сервер скидає keyStale при зміні fp.
- F3: runnable-програма клієнта тепер накладає повний `Program` з plan-версії (`applyProgramLayer`): targetWeight, RPE, відпочинок, нотатка, активності, dropLast; `planItemId` йде в сесію.
- F4: каунтери в обидва боки (`countered` у `canDecide`, `counterOf` у клієнта, картка від клієнта), прострочена відповідь дає зрозуміле повідомлення (`scFailExpired`, `rcErrExpired`, 5 мов).
- MED: summary/diff програми, push "Program updated", `programAck` callable + "seen" у вкладці Program тренера; часовий пояс тренера (`initCoachTimeZone`, `tz` у sealed schedules); клієнт викликає `configureNotes`; у fixtures-режимі банер `demoBody` пояснює окремі демо-дані.
- Тести: `client/src/coach/data/firestore/parity*.test.ts` (спільний MemoryFs + rules), `tests/coach-server/*`. Деталі: `iter16-parity-fix.md`.
- Не перевірено: емулятор rules, реальний Firebase, браузер/візуально, UI вибору часового поясу відсутній.

## Iteration 17: parity, частина 2, і перевірка «нічого не губиться» (закрито)

- Перевірено на спільному сховищі з rules: чат в обидва боки, tamper (шифртекст і підпис), офлайн-черга, share-картки, нотатки, security code, ротація ключа, зниження/відкликання/відновлення згоди, журнал читань, live, завершення зв'язку з обох боків (очищення, повторне зʼєднання), експорт, інвайти. Тести: `parity.lifecycle.test.ts`, `dataLoss.*.test.ts`, `program/dataLoss.editor.test.ts`.
- Виправлено: quiet hours не працювали для чату (тег `coach-message` проти `coach-chat`, сервер не читав `quiet`; `functions/src/coach/pushPolicy.ts`); live-документ тепер видаляє сервер при `totals: off`; картка старої програми йде за планом, картка тренування після зниження `sets` — locked, а не «removed»; diff/summary бачить назву дня, мʼязи, активності, розминку, кардіо, день, обладнання; назви залів їдуть у розкладі (`gymNames`); ціль у lb для клієнта; `program`/`programWeek` у ростері; `setRowMode(false)` не скидає підходи.
- Відкрито (рішення власника): категорії body/sleep/injury/nutrition клієнт може дати, але додаток тренера їх не читає (UI обіцяє показ); `streakWeeks`/`goal`/`gym` порожні в реальному адаптері; порівняння виконаного з призначеним відсутнє. Деталі: `iter17-parity-2.md`.
- Не перевірено: емулятор rules, реальний Firebase, браузер, push на пристрої, Playwright.

## Iteration 18: coach lock removed, wrong Now time, wider calendar with a real legend (закрито, not browser-verified by the owner)

- Coach lock: the idle lock / lock screen is removed (reasons in `COACH-SERVER-SECURITY.md`); sign-out stays the security boundary, per-action re-authentication (export, end, revoke) is kept. `VITE_COACH_IDLE_MINUTES`, `idleLock.ts`, the `lk*` strings (5 locales), the story and the tests of the lock are deleted (`_to_delete/iter18/`).
- Wrong time: the demo (fixtures) clock was "09:05 on 7 Oct, running on from page load", so the Now line showed ~09:30 while the viewer's clock said 17:14. Now `coach/data/demoClock.ts`: the fixture DAY with the viewer's real wall-clock minute (browser zone), ticking, DST-safe; wired to the default schedule, chat, notes and live fixture ports. The real backend always used `Date.now()` and the trainer's zone (default: the browser's, `initCoachTimeZone`); it was not affected. The world fixture (`FIXTURE_NOW`, Today signals / decisions) is still a frozen demo date by design.
- Calendar: full width when no session is open (the inspector column appears only with a selection), `--co-frame-wide` (1760) on big monitors; column packing like Google / Teams (`view.ts`), compact content tiers by container queries, one overlap marker per cluster; the legend chips are filters (`hide=` in the hash).

## Iteration 19: calendar navigation, create by click, inspector drawer, solid chat popover (закрито, not browser-verified by the owner)

- Integrity: `ScheduleScreen.tsx` (rebuilt in iter18) was compared with the schedule files, tests, stories and docs; no lost feature found (move/cancel/request flows, `hide=` legend filters, NowLine, a11y, empty/error states). No other empty or truncated files in `coach/`.
- Navigation: prev / next / Today / range label in the header, state in the hash (`d=`), both backends (the schedule docs are fully local, so the window is re-centred, no per-week loading), NowLine and today highlight only on the current week, touch swipe. Day headers read "Today · N sessions".
- Hour labels no longer touch the grid lines (checked at 1440 / 1024 / 390).
- Create: click, tap or drag on an empty slot (5-minute snap, coach timezone), `QuickCreate` with client picker, place, note, weekly repeat, conflict warning, ghost preview; saved through the same `store.save`. The New session button stays as the a11y alternative.
- Inspector is an overlay drawer (light scrim, X, focus return, content swap, bottom sheet on mobile, selected card highlighted) with a richer layout; the overlap pill opens the first conflict.
- Chat popover: solid frosted family-tinted glass, wider (420-460 px).
- Open: touch drag and long-press not tested in a real browser; the chat dock exists only at 1280 px and up; `tsOf` returns the second occurrence on an autumn DST repeat, contrary to its comment (pre-existing); nothing committed.

## Iteration 20: client demo world, coach-coloured overlays, calm calendar cards, working hours + gyms, info table (browser-checked in a fixtures build; nothing committed)

- **Client side (demo).** In fixtures mode (not in tests, not in real mode) the client coach screens now show a full demo relationship: trainer Iryna, program v5, upcoming sessions, chat, notes, access log. `coach/client/data/config.ts` `devScenario()`; override with `localStorage['spotter.clientCoach']`. Real mode keeps its empty states. The demo banner says both sides use the same sample people but changes are not carried across.
- **Overlays.** One plate recipe in `glass.css` (`--plate-top/--plate-bot/--plate-rim/--plate-edge`, graphite + accent under `html.theme-coach`, brass elsewhere) for sheet, drawer, dialog, popover, toast, chat dock. Portaled overlays read it from `<html>`, so they are coach-coloured. Panels get a sticky footer through `coach/layout/footerSlot.tsx` (`PanelFooter`); Add sessions, Quick create, Reschedule and the Session inspector all use it. Add sessions is kit controls only; the selected chip and weekday states have a ring.
- **Calendar cards and legend.** `coach/schedule/status.ts` is the single status map (Planned / In progress / Done / Missed / Proposed move + Overlap marker); `StateMark.tsx` draws the same swatch/icon on cards and legend chips. Cards: left bar + one glyph; running session = solid accent with a progress bar and "Now".
- **Now divider.** `nowDividerIndex` puts the divider before the first session that has not started; a running session is "In progress" with minutes left (agenda, week screen, grid). Tests: `status.test.ts`, `DayAgenda.now.test.tsx` (inside, between, before, after, overlapping, other day, Kyiv zone).
- **Working hours / gyms / 24h.** Calendar settings drawer (header icon; filter row on phone): per-weekday hours, My gyms (gym opening hours incl. 24/7 and overnight), range Auto / Work hours / 24 h. Pure logic in `schedule/hours.ts` (tests incl. 24/7, overnight, DST). Stored sealed: collection `calendarSettings` in `NEW_COLLECTIONS` at `users/{uid}/meta/calendarSettings` (`enc` + `updatedAt`), rules + pinned rules test updated. Non-working time is shaded (`.sc-off`), sessions outside hours are still drawn. Quick create and Add sessions default the gym from the chosen gyms and show `HoursNotice` (a warning, never a block).
- **Header search: PARKED.** The search icon is no longer rendered in the coach header (`HeaderSlots`); `CoachChrome.searchLabel/onSearch` stay in the type so it can come back.
- **Info table.** New kit primitive `Kit/InfoTable` (`components/ui/InfoTable.tsx`, plain read-only key-value list) is used for the roster detail facts. "Shares with you" lists only the consented categories the trainer can read today (totals, sets, injuries); "Restriction" says "Not shared" vs "Shared, none declared" (never "None reported" for a client who shares injuries).
- **Not done / honest limits.** Injury notes themselves are still not readable by the trainer (only a declared restriction). Client "Stop sharing", security code, exports screens were not re-walked in the last build. The server-api vitest file cannot load better-sqlite3 in the Linux VM (native module built for macOS), unrelated.

## Iteration 21: real trainer data on the client, one switch-control family, calendar cards (nothing committed; real Firebase not reachable from the sandbox)

- **Client uses the real backend.** The app's own "Trainer" card comes from the legacy `profileMe` (`users.trainerId`); tapping it opened coach screens on
  FIXTURES because an unset `VITE_COACH_BACKEND` meant fixtures in dev. Default is now the real backend (table above). Same selection for the trainer
  dashboard (`coachBackendMode()` is the one source). A mis-install never falls back to samples (unavailable ports + `failed` status). In real mode
  `#/trainer` used to bounce to Today while the adapters installed; it now waits on a skeleton.
- **Legacy trainer to coach relationship.** New callable `coachAdoptLegacy` (`adoptMyLegacyTrainer`, same cut as the admin backfill `coachMigrateLegacy`: mode
  `app`, every consent level OFF, `migratedFrom: 'legacy-trainerId'`, trainer + client get the usual notice). The member's port asks once per session
  when there is no active `coaching/{me}`, then runs the key exchange. `ClientLink.migrated` (nothing shared yet) drives a note on My trainer with a
  button to Sharing settings: the consent prompt. Deploy the function (`firebase deploy --only functions:coachAdoptLegacy`) before relying on it; an
  older server answers "unimplemented" and the client simply shows "No trainer yet" (silent retry next session).
- **One switch-control family**: Segmented / ScrollTabs / Chip(+ChipGroup) styled only by `--seg-*`, `--segb-*`, `--segs-*`, `--chip-*`, `--tab-*` tokens
  (`styles.css`). Concentric radii (`--seg-r-outer = --seg-r-inner + --seg-pad`), no double borders, one height scale. New: `Segmented scroll`,
  `Chip count`, `ChipGroup scroll | fill`. The Brass Glass overrides of segments / chips in `glass.css` are gone (the tokens carry the look).
  Re-theme how-to and the proof harness: `docs/THEME-SWAP.md`.
- **Calendar cards**: the status bar is an inset pill inside the padding box (no crescent against the card radius), the state glyph sits in a fixed
  top-right slot on the name row, 30-minute cards are one line, narrow cards drop the avatar before the name.
- Guards: `tests/kit-guard.test.ts` gained the switch-control guard and a "token-step literal inside calc()/max()/clamp()" guard (61 literals fixed).

Not proven (needs a live project): `coachAdoptLegacy` against real Firestore, the real client screens with a real account, Firestore rules for the adoption write
(it is server-side, no new client write path). Everything above is tested on the in-memory server + `memoryFs` + enforced rules.

## Iteration 22 - one control-height scale

- Tokens `--ctl-h-xs/sm/md/lg` (28/36/44/52, md = `--tap-min`) plus per-size px/gap/font/icon in `client/src/styles.css`. Every kit control (Button, IconButton, Segmented, Chip, Field, Select, SearchField, TimeField, ScrollTabs, PresetChips, BackButton, ExportMenu...) reads them via a per-size scope (`--ctl-h`). Same `size` prop everywhere, default md (chips/back: sm).
- `ControlRow` / `.ctl-row--{size}` forces one height across a row (coach Toolbar, header actions, bespoke headers). Local height/padding overrides removed.
- Guard: `tests/kit-guard.test.ts` control-height guard; `client/src/components/ui/controlScale.test.ts` (token resolution); story `Kit/ControlHeights`.
- Measured with Playwright: app routes 382 off-scale controls / 151 mixed rows -> 0 / 1 (documented false positive). Docs: UI-KIT.md, THEME-SWAP.md (overriding `--ctl-h-*` rescales everything).
- Not proven: final Storybook re-measure after the last Log-activity Back size fix; real Firebase not involved. Nothing committed.

## Iteration 23 - real-mode failures made visible, dev default = demo (nothing committed)

- **Dev default.** `npm run dev` with `VITE_COACH_BACKEND` unset = fixtures (demo banner); production = firestore; `VITE_COACH_BACKEND=firestore` opts in; dev override key `spotter.coachBackend` ("Use demo data"). See COACH-BACKEND.md section 7 for the exact deploy checklist.
- **Never hangs.** 8 s first-load timeout (trainer and client); kit error states for offline / not-deployed / denied / timeout / unknown with Retry; dev hint + "Use demo data". The client keeps the legacy trainer card (calm note, Sharing settings) when Coach is unavailable; a failed `coachAdoptLegacy` is an error, not "No trainer yet". ClientChat has the page shell.
- **Trainer side data.** Shared injuries (read-only list in Client 360, restriction line), streakWeeks, history with logged-vs-prescribed and optional gym, access-log counts, invite resend (revoke + create), `tsOf` DST-repeat fix (first occurrence), client-left notice names, shared notes deleted on relationship end (server).
- **Kit.** Dead legacy rules removed from styles.css (lens-seg buttons, act-effort-seg, ch-filter-chips buttons, eq-chip).
- **Verified in a browser (Playwright, stubbed backend):** trainer Today for 404/403/abort, client My trainer (offline, legacy 404), fixtures build Today / Schedule / client My trainer at 1440 and 390.
- **Tests only:** dev hint + demo button, injuries, history, resend, access-log counts, server notice/notes.

### What is left for the owner

1. Run the deploy checklist in COACH-BACKEND.md section 7 on spotter-64c3b (rules, indexes, functions, secrets COACH_PEPPER / COACH_SIGNING_KEY / APP_ORIGIN) and open Coach with `VITE_COACH_BACKEND=firestore`; which item is missing live is unknown from the sandbox.
2. Real adapter: `goal` and gym name are not published by the member, so trainer cards show no gym name; the engine injury signal is not fed; history `planned` = done and `withTrainer`/`pr` are false.
3. Chat/schedule error states distinguish only offline vs unknown.
4. Not done: coach Drawer to ResponsivePanel, derived font sizes / ~59 accent selectors to tokens, control-height re-measure (incl. Storybook, Log-activity row).
5. Not yet seen in a browser: client Stop sharing, security code, exports, Session inspector 1024/390, outside-hours warning, migrated client My trainer in real data.
6. Pre-existing: the "Slow connection" banner overlaps the app header at 390. Stray 132 MB `_shots/iter23/distReal.tgz` / `distDemo.tgz` could not be deleted (no-delete sandbox).

## Iteration 24 - kit discipline pass, trainer gyms, real data (nothing committed)

- **Coach drawer removed.** `SidePanel` is now a thin wrapper of the kit `Sheet` (bottom sheet on phone, right panel from 720 px); `Layout` has no Drawer, dead `.co-drawer` CSS is gone, coach colours come only from theme tokens (`useCoachOverlayTheme` for portaled overlays, `--glass-raised-base`). Kit-guard now fails if coach defines its own Drawer / Switch / Chip / ListRow / Segmented or `.co-drawer`.
- **A/B.** Calendar settings, Add sessions, One-off and Session inspector use the kit Sheet + kit rows (Switch sm, TimeField sm, Checkbox rows, GymPicker for "Add a gym"); compact one-row-per-day working-hours table; pinned opaque footer. My gyms is a checkbox multi-select with hours, saved in the sealed calendar settings; the schedule Gym filter lists the ticked gyms (all until one is ticked); a header "Gyms" chip opens the settings.
- **C/D/E.** Toolbar is one aligned ctl row with inline select labels (`Select labelInline`); card padding tokens, single-row tier up to 52 px, avatar hidden in narrow overlap lanes; Segmented/Chip descenders fixed with `--ctl-lh`.
- **F.** `useFitCount` (ResizeObserver) fills the roster strip, "+N" last in the same row; tests with mocked widths.
- **G/H.** Read-only facts are `InfoTable`; Training days are static `WeekdayToggle` tiles. Assignment panel: trainer/admin toggle Solo / With trainer per day (Rest days are not toggled here: the program owns them), Set times, pending/saved, validation list with clickable issues; the "v draft" row is disabled at 0 changes.
- **I/J/K.** Composer helper text on its own line; share dialog has type chips with counts (no All chip), "Suggested for this chat", more-by-type with Show all, coach theme; reschedule card restyled on kit parts.
- **L real data.** `pr` (estimated 1RM beats every earlier session), `withTrainer` (logged within 90 min of a scheduled 1:1) and weekly `planned` (schedule) are derived (`worldMap.ts`, `scheduleJoin.ts: joinHistory`); empty goal / gym are hidden, not drawn blank; the unused `pendingRequestPort` / `navigatingRequestPort` stubs left production code. Dev default is auto (probe) - see COACH-BACKEND.md.
- **Verified in a browser (Playwright, fixtures build, 1440/1024/390):** schedule toolbar, cards, settings / add sessions sheets, gyms chip, Client 360, program editor, chat composer, share dialog, client My trainer. **Tests only:** probe, auto mode, joinHistory/PR, gym filter, SidePanel, useFitCount / RosterStrip, kit-guard.

### What is left

1. Engine injury signal still not fed (needs a program loader dependency in install.ts); `goal` and gym name are not published by the member, so they are hidden.
2. Not re-measured: control-height script and theme-swap harness; not seen in a browser: Assignment menu states, quick-create sheet, Show all groups in the share dialog, uk/pl/lt/et Segmented at 390.
3. Real-backend probe not exercised against a deployed backend (sandbox).

## Iteration 25 - no demo data in the product, Today -> Agenda, "Training now" popover (nothing committed)

- **Demo removed.** `backend.ts` has one backend (real) plus `off`; `DEV_BACKEND_KEY` / `setDevBackendOverride` / `canOfferDemo` / `coachIsDemo`, `DemoNotice`, the "Use demo data" button, the roster "sample workspace" (button, banner, read-only mode) and the i18n strings (`demoTitle`, `demoBody`, `pbUseDemo`, `roSample*`, `roLookH`, 5 locales) are gone. Runtime configs (`data/config.ts`, `live`, `share`, `program`, `schedule`, `notes`, `client`, `security`) default to the unavailable stand-ins (`data/unavailable.ts`).
- **Fixtures moved** to `__fixtures__` directories (data, chat, schedule, notes, program, share, screens/live, client/data, security); `createFixturesProgramPort`, the trust and reauth doubles were split out of runtime files; the lab gyms (`GYMS`) moved to `schedule/__fixtures__/gyms.ts`. One door: `coach/data/testHooks.ts` (constant `undefined` in an app build). Registered by `coach/__fixtures__/register.ts` from the Vitest setup file, `.storybook/preview.tsx` and the QA entry. `setCoachBackendMode` now lives in `register.ts`.
- **Guard.** `tests/kit-guard.test.ts`: runtime code must not import `__fixtures__` / fixture files or mention the removed switches; the app entry must not load the registration.
- **Proof.** `vite build` (production, temp outDir `_shots/iter25/prod`): 0 matches in `dist` for Oleh, Iryna, Taras Rudenko, Bohdan Palamar, Maria Tkach, Denys Koval, Iron Yard, FitHub, Pozniaky, "Use demo data", "demo data", `demoTitle`, `__SPOTTER_COACH_TEST__`, `spotter.coachBackend`, `spotter.clientCoach`, Демо-дані, "sample workspace" (while `coach-backend-failed` and "Training now" ARE in the bundle, so the grep is meaningful).
- **Agenda.** The trainer's Today is "Agenda" (uk Агенда, pl Agenda, lt Darbotvarkė, et Päevakava) with the kit icon `calendar-check`: rail, tab bar, page title, Back buttons, "Go to / Open / Back to Agenda", Signals back, error and not-found states, Storybook titles, tests. Route id `agenda`, hash `#/c/agenda`; `#/c/today` (also saved "last screen" values) still opens it. The member app's Today and `#/today` are untouched.
- **"Training now" popover.** Kit Popover 400 px, flat GroupedList per group (no card in the card), ListRow per person: avatar, one-line name, one-line meta "place · since HH:MM" (finished: totals), elapsed time with a `SeverityDot` on the right (live ok, offline amber, finished neutral), no chevrons (the row is the hover target and only a button when it navigates), small muted footer. New string `liveSinceLine` (5 locales); `liveStarted` and `LiveEntry.metricSub` removed (`statusText` = dot tooltip).
- **Verified in a browser (Playwright, QA build, 1440/390):** Agenda page, rail and tab bar, `#/c/today` alias, Signals Back, "Training now" popover. **Measured:** control heights 1089 controls, 0 off-scale, 1 mixed row (known false positive: link button in the program editor); theme swap: radius 0, gap 0, padding 3 (tabbar FAB, 76 px clearance x2: intentional, unchanged since iteration 21). **Tests only:** testHooks gating, unavailable defaults, kit-guard, route alias.
- **Not done / unverified:** Storybook was not rebuilt or re-scanned; real backend still never run against a deployed project; Agenda strings in uk/pl/lt/et not reviewed by a native speaker (lt/et declension chosen by hand).
