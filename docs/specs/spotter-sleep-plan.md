# Spotter · Sleep — implementation plan

Design: `My Fit - Sleep.dc.html` (SL-01…SL-13, SL-W1/W2).

## Essence
Sleep is a first-class recovery record. Starting sleep flips the WHOLE app into a
calm night mode under a live, battery-capped sky and a moon at tonight's real phase
for the user's location. On waking it folds the night into readiness, recovery,
energy and Mastery.

## Unique twist — "Spotter Sky"
The night sky is a star journal generated from ALL logged workouts + activities.
Each log is a star: size ∝ dose/volume, colour/temperature ∝ type (lifting = brass,
cardio = lazurite, recovery = soft cyan, PR = near-white). You rest under the sky
your training built.

Three layers by age (only one is animated → scales to a lifetime of logs):
1. Dust (oldest, static, aggregated into the Milky Way band; binned so cost is
   bounded even at thousands of logs).
2. Deep field (older individual logs, tiny/faint, size & brightness decay with age;
   rendered ONCE to an offscreen/cached bitmap, redrawn only on new log/resize →
   thousands OK, one drawImage per frame).
3. Foreground (newest/most significant, large/bright/twinkling; the only per-frame
   work; count capped adaptively by device tier / DPR / battery).
Age drives a continuous size/brightness curve; stars migrate foreground → deep field
→ dust as they age (nothing disappears, the band enriches). Guardrails: rAF frame cap
+ pause when hidden, prefers-reduced-motion → static, DPR cap, deterministic seed from
log ids. Phase 3 includes a 100/1000/5000-log stress test measuring FPS/frame time.

## Acceptance criteria (A–F)
A. Entry three ways — Sleep panel in Log activity (SL-01): live Start/Stop (SL-02/03),
   backfill a past night (SL-13), schedule pre-fill (SL-07).
B. Whole-app night mode (SL-02/03/04/W1): token flip everywhere incl. desktop rail/
   header; navigation stays usable; seal/wordmark/language keep colour; live Milky Way
   + phase-accurate moon; auto-dim at bedtime with Start / Not yet 15m / Keep lit (SL-08).
C. Honest wake (SL-05/06): Stop never guesses — "when did you wake?" chips + exact time
   + live duration; then logged card, duration vs goal, % on rhythm, optional quality.
D. Schedule (SL-07): same-most-nights or per-weekday; this table is what auto-log learns.
E. Auto-log once earned (SL-09/10): only after deep, stable history (≈6 wks, high
   confidence); fills each night from that WEEKDAY's rhythm; flagged auto; editable →
   the fix teaches the pattern.
F. Reminders + history (SL-11/12/W2): forgot-to-log nudge habit-gated (never nags
   newcomers/lapsed) + morning notification; history = rolling avg, bedtime consistency,
   last 14 nights vs goal, learned weekday rhythm.

## Data model (store slices, localStorage, same pattern as mastery/activities)
- `sleeps: SleepNight[]` — { id, date(YYYY-MM-DD of the wake day), bedtime(ms), wake(ms|null
  = in progress), quality?, source: 'live'|'backfill'|'auto'|'schedule' }. Live night =
  the one with wake===null (mirrors the open workout). Key `spotter.sleeps`.
- `sleepSchedule` — { sameEveryNight: boolean, byDay: Record<0..6,{bedMin,wakeMin}> }.
  Key `spotter.sleep.schedule`.
- `sleepSettings` — { autoDim, autoLog, goalMin, seenPatternOffer, lastDimDay }.
  Key `spotter.sleep.settings`.
Setters: startSleep / stopSleep(wakeAt) / logSleepNight(night) / updateSleepNight /
removeSleepNight / setSleepQuality / setSleepSchedule / setSleepSettings.

## Pure modules (+ vitest)
- `sleep.ts` — durationMin, weekdayPattern+confidence, consistency, stats(avg/goalMet/
  streak/Δ), lastNight, sleepReadinessBias(-1..1), sleepDebtMin, autoLogEligible.
- `moon.ts` — moonPhase(date) → {phase 0..1, illum, waxing, name}; limb from lat/long.
- `energy.ts` — bmrKcal(bodyMetrics) (Mifflin-St Jeor; Katch-McArdle when bodyFat known),
  tdee, overnightRecoveryKcal(night). Reused by Today + recaps.

## Sync everywhere
- Readiness (recovery.ts / activities.ts boost channel): full night raises next-day
  readiness; short/irregular slows it, can raise a deload nudge. Surfaced in Today
  readiness banner + session coach.
- Recovery: chronic short/missing = recovery gap.
- Mastery (mastery.ts): sleep in Practice/recovery discipline — recovery/rest signals +
  a sleep sub-signal; consistency+sufficiency lift rating; gap shows in shortfalls/how-to-rise.
- Energy (energy.ts → Today kcal + recaps): BMR baseline + overnight recovery energy.
- Night mode theming (App shell + views + desktop rail).
- Notifications (notifications.ts): bedtime auto-dim + habit-gated morning nudge.
- Geolocation: reuse store.ts cached position (permission-aware, no re-prompt) → moon
  location; fall back to timezone.

## i18n
All new strings localized in en/uk/pl/lt/et from the start (localize, not literal),
including moon phase names.

## Phases
1 data+modules+tests · 2 i18n · 3 night mode + Spotter Sky (+stress test) ·
4 entry flows · 5 schedule+auto-dim · 6 sync · 7 auto-log+reminders+history ·
8 verify+commit per phase. User pushes + `firebase deploy`.
