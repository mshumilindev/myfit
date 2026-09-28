# Spotter · Session summary → "Next up" activities (post-workout suggestion)

Read BRIEF.md (tokens, file rules), BRIEF2.md (merged Log activity page), and match the finished merged artboards in `project/` exactly: `m01-default.dc.html`, `m03-quicklog.dc.html`, `m07-live.dc.html`, `w01-default.dc.html`, `w02-quicklog.dc.html` (header, cards, colours, quick-log sheet, live banner).

## The real screen today (Session summary, shown right after "Finish")

Top: green check "Session saved". Big headline "Done." (32px), under it "Saturday, 28 Sep · Gym Sport Life". An Atlas debrief bubble (Atlas avatar + 1–2 short lines in his voice, e.g. "Chest volume up 8 %. Bench stalled at 80 — tomorrow we fix it."). A 3-cell stat grid: Duration 1:12 · Sets 21 · Moved 6.4 t (+ Cardio min / Distance cells when present). Energy plaque "≈ 540 kcal". "Muscle groups worked" list (Chest, Triceps, Front delts with bars). "New record" panel (trophy, "Incline Bench · 32.5 kg × 8"). "Compared to last session" rows with ±% deltas (green up / red down). Bottom actions: primary "Share workout", then two secondary: "Edit session" | "Done".

## New: "Next up" when history shows a pattern

If the user's history shows they often do something right after lifting (e.g. Sauna after 6 of the last 8 sessions; Walk 20 min after leg days; Stretching after heavy days), the summary offers to START it immediately. Place it high (right after the headline/Atlas, before stats) — it's time-sensitive. Explain why ("You hit the sauna after 6 of your last 8 sessions"). One tap starts the live timer (becomes a live activity, like m07's banner) or logs it with a preset. Allow "Not today" and a small "Don't suggest this" (per-activity) in an overflow. Multiple candidates: show the top one prominently + up to 2 alternatives as chips. Respect the colour families (recovery blue for Sauna/Stretch/Cold, conditioning gold for Walk/Run, sports green).

## Artboards (write into project/, same file format rules)

Mobile 390 wide (tall ones 390×1300 to show the full summary):

- `p01-summary-nextup.dc.html` (390×1300) — Summary with the "Next up" card: Sauna 20 min (blue), reason line, primary "Start sauna" + secondary "Log 20 min", alternatives chips "Stretch 10 min", "Walk 20 min", overflow "⋯" (not today / don't suggest). Rest of the summary below as today.
- `p02-nextup-started.dc.html` (390×844) — After tapping Start: summary scrolled to top with a sticky live banner "Sauna · 03:12 · Pause · Finish" in blue, the Next-up card turned into a compact "Sauna running — we'll count it as recovery" state; Done still works (the timer keeps running).
- `p03-nextup-options.dc.html` (390×844) — The overflow opened as a small bottom sheet: "Not today", "Change to…" (opens the Log activity page), "Don't suggest Sauna after workouts", plus a note "Suggestions come from your last 8 sessions".
- `p04-no-pattern.dc.html` (390×844) — No clear pattern (or first weeks): no big card; instead a quiet one-line row under the stats "Anything after this? Log activity ›" (link to the Log activity page).
  Web 1280×800:
- `p05-web-summary.dc.html` — desktop shell (left icon rail 64px as in w01), summary in a centred column (max ~720) with the Next-up card at the top right of the header area or as a prominent card in a right column (your call, consistent with w01/w02), stats grid 4-up.
  Titles "P01 · Summary + Next up (full)", "P02 · Sauna started", "P03 · Next-up options", "P04 · No pattern", "P05 · Web summary". Prototype: p01 Start → p02; p01 ⋯ → p03; back links where natural. No emoji, real buttons, aria-labels. Don't render or verify. Reply ONLY with JSON {"file":"title",…}.
