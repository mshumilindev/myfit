/**
 * Sleep automation — the "it runs itself" layer (SL-08 … SL-11).
 *
 * Rendered once, globally, from the app shell. It decides, from the schedule +
 * settings + learned pattern, whether to surface anything:
 *   • SL-08 auto-dim — at your usual bedtime the app crosses into night on its
 *     own with a quiet "start / not yet / keep lit" prompt.
 *   • SL-09 auto-log offer — once the history earns it (≈6 wks, high confidence)
 *     a one-time offer to fill nights from your per-weekday rhythm.
 *   • SL-10 auto-fill — with auto-log on, missing recent nights are filled
 *     silently from that weekday's pattern, flagged `auto` and editable.
 * (SL-11 forgot-to-log lives in Today via SleepForgotBanner / sleepForgotNudge.)
 */
import { useEffect, useState } from 'react';
import { useT, fmtDurationHuman } from '../i18n';
import {
  useStore,
  liveSleep,
  startSleep,
  logSleepNight,
  setSleepSettings,
  sleepDayId,
  updateSleepNight,
  noteSleepPresence,
  reconcileSleep,
} from '../store';
import { weekdayPattern, planForWeekday, planDurationMin, finishedNights } from '../sleep';
import { Icon } from '../ui';
import { MoonGlyph } from './MoonGlyph';
import { moonInfo, illumPct } from '../moon';
import type { SleepDayPlan, SleepNight } from '../types';

const DAY = 86400000;
const MIN = 60000;
const WD_ORDER = [1, 2, 3, 4, 5, 6, 0]; // display Mon..Sun → JS getDay

const dur = (min: number) => fmtDurationHuman(Math.max(0, min) * 60000);

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function clock(mins: number): string {
  const h = Math.floor((((mins % 1440) + 1440) % 1440) / 60);
  const m = ((mins % 60) + 60) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function tzPlace(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    return tz.split('/').pop()?.replace(/_/g, ' ') || '';
  } catch {
    return '';
  }
}

/** The plan (schedule first, then learned pattern) for a given weekday. */
export function planFor(
  store: ReturnType<typeof useStore>,
  weekday: number,
  now: number,
): SleepDayPlan | null {
  const sched = planForWeekday(store.sleepSchedule, weekday);
  if (sched) return sched;
  const pat = weekdayPattern(store.sleeps, now).byDay[weekday];
  if (pat) return { bedMin: pat.bedMin, wakeMin: pat.wakeMin };
  return null;
}

/** Build a finished night ending on `wakeDayStart`'s morning from a plan. */
function nightFromPlan(
  wakeDayStart: number,
  p: SleepDayPlan,
): { date: string; bedtime: number; wake: number; source: SleepNight['source'] } {
  const wake = wakeDayStart + p.wakeMin * MIN;
  const durMin = planDurationMin(p);
  const bedtime = wake - durMin * MIN;
  return { date: sleepDayId(wake), bedtime, wake, source: 'auto' };
}

export function SleepAutomation({ onOpenSchedule }: { onOpenSchedule: () => void }) {
  const { t } = useT();
  const store = useStore();
  const [now] = useState(() => Date.now());
  const live = liveSleep(store.sleeps);
  const s = store.sleepSettings;

  // Local, session-only interaction state (no re-nag within a session).
  const [snoozeUntil, setSnoozeUntil] = useState(0);
  const [tick, setTick] = useState(now);
  const [dimDismissed, setDimDismissed] = useState(false);
  const [offerDismissed, setOfferDismissed] = useState(false);

  // Re-evaluate every minute so bedtime / snooze windows open on their own.
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 60000);
    return () => window.clearInterval(id);
  }, []);

  // ---- SL-10 auto-fill: ensure recent nights exist when auto-log is on ------
  useEffect(() => {
    if (!s.autoLog || live) return;
    const today0 = startOfDay(tick);
    const existing = new Set(store.sleeps.filter((n) => n.wake !== null).map((n) => n.date));
    const toAdd: Array<{
      date: string;
      bedtime: number;
      wake: number;
      source: SleepNight['source'];
    }> = [];
    // Fill up to the last 3 mornings (in case the app went unopened a day or two).
    for (let back = 0; back < 3; back++) {
      const wakeDay0 = today0 - back * DAY;
      const id = sleepDayId(wakeDay0);
      if (existing.has(id)) continue;
      const p = planFor(store, new Date(wakeDay0).getDay(), tick);
      if (!p) continue;
      const wake = wakeDay0 + p.wakeMin * MIN;
      if (wake > tick) continue; // usual wake time not reached yet
      toAdd.push(nightFromPlan(wakeDay0, p));
    }
    if (toAdd.length) {
      queueMicrotask(() => {
        for (const n of toAdd) logSleepNight(n);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.autoLog, live, tick]);

  // ---- SL-08 auto-dim: is it my usual bedtime right now? -------------------
  const todayId = sleepDayId(tick);
  const plan = planFor(store, new Date(tick).getDay(), tick);
  const nowMin = new Date(tick).getHours() * 60 + new Date(tick).getMinutes();
  const sinceBed = plan ? (nowMin - plan.bedMin + 1440) % 1440 : 9999;
  const showDim =
    s.autoDim &&
    !live &&
    !dimDismissed &&
    !!plan &&
    sinceBed < 180 && // within 3h after usual bedtime
    s.lastDimDay !== todayId &&
    tick >= snoozeUntil;

  // ---- SL-09 auto-log offer: has the data earned it? ----------------------
  const pattern = weekdayPattern(store.sleeps, tick);
  const showOffer =
    !showDim &&
    !live &&
    !offerDismissed &&
    !s.autoLog &&
    (s.patternOffer ?? 'unseen') === 'unseen' &&
    pattern.autoLogEligible;

  if (showDim && plan) {
    const moon = moonInfo(new Date(tick));
    const startNow = () => {
      setSleepSettings({ lastDimDay: todayId });
      queueMicrotask(() => startSleep());
    };
    const snooze = () => setSnoozeUntil(tick + 15 * MIN);
    const keepLit = () => {
      setSleepSettings({ lastDimDay: todayId });
      setDimDismissed(true);
    };
    return (
      <div className="sleep-auto-scrim night" role="dialog" aria-modal="true">
        <div className="sleep-auto-dim">
          <div className="sad-intro">
            <div className="sad-moon">
              <MoonGlyph size={104} date={tick} />
            </div>
            <div className="sad-phase">
              <Icon name="moon-stars" weight="fill" />
              {t.sleepMoonLine(t.moonPhase[moon.name] ?? moon.name, illumPct(moon), tzPlace())}
            </div>
            <div className="sad-title">{t.sleepBedtimeArrived}</div>
            <div className="sad-body">{t.sleepBedtimeBody(clock(plan.bedMin))}</div>
          </div>
          <div className="sad-actions">
            <button className="btn-moon" onClick={startNow}>
              <Icon name="moon-stars" weight="fill" />
              {t.sleepStart}
            </button>
            <div className="sad-row">
              <button className="btn-out-moon" onClick={snooze}>
                {t.sleepNotYet15}
              </button>
              <button className="sad-quiet" onClick={keepLit}>
                {t.sleepKeepLit}
              </button>
            </div>
          </div>
          <div className="sad-foot">{t.sleepAutoDimFoot}</div>
        </div>
      </div>
    );
  }

  if (showOffer) {
    const maxWd = Math.max(1, ...WD_ORDER.map((d) => pattern.byDay[d]?.durMin ?? 0));
    const accept = () => {
      setSleepSettings({ autoLog: true, patternOffer: 'accepted' });
      setOfferDismissed(true);
    };
    const decline = () => {
      setSleepSettings({ patternOffer: 'declined' });
      setOfferDismissed(true);
    };
    return (
      <div className="sleep-auto-scrim" role="dialog" aria-modal="true">
        <div className="sleep-auto-offer">
          <div className="sao-sky">
            <span className="chip sao-chip">
              <Icon name="sparkle" weight="bold" />
              {t.sleepPatternLearned}
            </span>
            <div className="sao-h">{t.sleepAutoLogOfferTitle}</div>
            <div className="sao-sub">{t.sleepPatternOffer}</div>
          </div>
          <div className="sao-conf">
            <Icon name="chart-bar" weight="bold" />
            <div className="sao-conf-txt">
              <div className="sao-conf-t">{t.sleepConfidenceHigh}</div>
              <div className="sao-conf-d">{t.sleepConfidenceDesc}</div>
            </div>
            <span className="sao-bars">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className={i < 4 ? 'on' : ''} />
              ))}
            </span>
          </div>
          <div className="sao-fill">
            <div className="sao-fill-lbl">{t.sleepRhythmWeekday}</div>
            <div className="sao-rhythm">
              {WD_ORDER.map((d, i) => {
                const p = pattern.byDay[d];
                const h = p ? Math.max(8, Math.round((p.durMin / maxWd) * 100)) : 0;
                const wk = d === 0 || d === 6;
                return (
                  <div key={d} className="sao-rcol" title={p ? dur(p.durMin) : ''}>
                    <div className="sao-rtrack">
                      <span className={`sao-rbar${wk ? ' wk' : ''}`} style={{ height: `${h}%` }} />
                    </div>
                    <span className={`sao-rwd${wk ? ' wk' : ''}`}>{t.weekDayLetters[i]}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="sao-note">
            <Icon name="pencil-simple-line" weight="bold" />
            <span>
              {t.sleepAutoEditableNote} <span className="sao-badge">{t.sleepAutoBadge}</span>
            </span>
          </div>
          <div className="sao-actions">
            <button className="btn-secondary sao-ghost" onClick={decline}>
              {t.sleepNotNow}
            </button>
            <button className="btn-primary" onClick={accept}>
              <Icon name="sparkle" weight="bold" />
              {t.sleepTurnOnAutoLog}
            </button>
          </div>
          <button
            className="sao-manage"
            onClick={() => {
              setOfferDismissed(true);
              onOpenSchedule();
            }}
          >
            {t.sleepManage}
          </button>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * SL-11 — the forgot-to-log nudge, habit-gated. Returns null unless the person
 * already logs sleep as a habit (established, recent, not lapsed) AND last
 * night's record is genuinely missing. Never shown when auto-log is on (nights
 * fill themselves) or to a newcomer / lapsed user (who'd find it nagging).
 */
export function SleepForgotBanner({ onOpenBackfill }: { onOpenBackfill: () => void }) {
  const { t } = useT();
  const store = useStore();
  const [now] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState(false);
  const s = store.sleepSettings;
  const live = liveSleep(store.sleeps);

  if (s.autoLog || live || dismissed) return null;

  const finished = finishedNights(store.sleeps, now);
  const today0 = startOfDay(now);
  const todayId = sleepDayId(today0);
  const last14 = finished.filter((n) => n.bedtime >= now - 14 * DAY);
  const loggedLast4 = finished.some((n) => n.bedtime >= now - 4 * DAY);
  // Habit gate: established history, an active recent habit, and not lapsed.
  const habit = finished.length >= 14 && last14.length >= 10 && loggedLast4;
  if (!habit) return null;

  // Is last night (this morning's record) missing?
  const haveToday = store.sleeps.some((n) => n.wake !== null && n.date === todayId);
  if (haveToday) return null;

  // Only after the usual wake time has passed.
  const yWeekday = new Date(today0 - DAY).getDay();
  const p = planFor(store, yWeekday, now);
  const wakeMin = p ? p.wakeMin : 9 * 60;
  if (now < today0 + wakeMin * MIN) return null;

  const usualDur = p ? planDurationMin(p) : Math.round(sleepAvg(finished));
  const useUsual = () => {
    if (p) {
      queueMicrotask(() => logSleepNight({ ...nightFromPlan(today0, p), source: 'backfill' }));
    } else {
      onOpenBackfill();
    }
    setDismissed(true);
  };

  return (
    <div className="sleep-forgot">
      <div className="sky-mini" aria-hidden="true" />
      <div className="sfg-body">
        <div className="sfg-row">
          <span className="sfg-ic">
            <Icon name="moon" weight="bold" />
          </span>
          <div className="sfg-txt">
            <div className="sfg-t">{t.sleepMissingTitle}</div>
            <div className="sfg-d">{t.sleepMissingBody(last14.length, 14)}</div>
          </div>
          <button className="sfg-x" aria-label={t.done} onClick={() => setDismissed(true)}>
            <Icon name="x" weight="bold" />
          </button>
        </div>
        <div className="sfg-actions">
          <button className="sfg-use" onClick={useUsual}>
            {t.sleepUseUsual(dur(usualDur))}
          </button>
          <button
            className="sfg-enter"
            onClick={() => {
              setDismissed(true);
              onOpenBackfill();
            }}
          >
            {t.sleepEnterManually}
          </button>
        </div>
      </div>
    </div>
  );
}

function sleepAvg(finished: SleepNight[]): number {
  if (!finished.length) return 480;
  const recent = finished.slice(0, 14);
  const total = recent.reduce((sum, n) => sum + (n.wake ? (n.wake - n.bedtime) / MIN : 0), 0);
  return total / recent.length;
}

/**
 * SL-10 — the auto-filled morning card. With auto-log on, last night's record
 * is simply there when you wake, flagged `auto`; this surfaces it on Today so
 * you can confirm ("Looks right") or fix it ("Adjust times") — and the fix
 * teaches the pattern. Confirming clears the flag so it stops nudging.
 */
export function SleepAutoFilledCard({ onOpenBackfill }: { onOpenBackfill: () => void }) {
  const { t } = useT();
  const store = useStore();
  const [now] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState(false);
  const live = liveSleep(store.sleeps);
  if (!store.sleepSettings.autoLog || live || dismissed) return null;

  const todayId = sleepDayId(startOfDay(now));
  const night = store.sleeps.find((n) => n.wake !== null && n.date === todayId);
  if (!night || night.source !== 'auto') return null;

  const durMin = night.wake ? Math.round((night.wake - night.bedtime) / MIN) : 0;
  const range = `${hhmm(night.bedtime)}→${hhmm(night.wake as number)}`;
  const wdName = t.weekDayNames[(new Date(night.bedtime).getDay() + 6) % 7];
  const looksRight = () => {
    queueMicrotask(() => updateSleepNight(night.id, { source: 'backfill' }));
    setDismissed(true);
  };
  return (
    <div className="sleep-autofill">
      <div className="sky-mini" aria-hidden="true" />
      <div className="saf-body">
        <div className="saf-row">
          <span className="saf-ic">
            <Icon name="moon-stars" weight="fill" />
          </span>
          <div className="saf-txt">
            <div className="saf-head">
              <span className="saf-line num">{t.sleepLastNight(dur(durMin), range)}</span>
              <span className="sao-badge">
                <Icon name="sparkle" weight="bold" />
                {t.sleepAutoBadge}
              </span>
            </div>
            <div className="saf-note">{t.sleepAutoFilledFrom(wdName)}</div>
          </div>
        </div>
        <div className="saf-actions">
          <button className="saf-adjust" onClick={onOpenBackfill}>
            <Icon name="pencil-simple" weight="bold" />
            {t.sleepAdjustTimes}
          </button>
          <button className="saf-ok" onClick={looksRight}>
            {t.sleepLooksRight}
          </button>
        </div>
      </div>
    </div>
  );
}

function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Sleep pause controller. A live night counts as sleep only while you're on the
 * sleep screen. Leave it (to walk the app) and the timer pauses; but if you
 * then go quiet for SLEEP_IDLE_MS or close the app, that means you actually
 * fell asleep, so the timer resumes counting from your last activity. Rendered
 * once, globally; `onSleepScreen` is derived by the shell from the overlay.
 */
export function SleepPauseController({ onSleepScreen }: { onSleepScreen: boolean }) {
  const store = useStore();
  const liveId = liveSleep(store.sleeps)?.id ?? null;

  // Count on the sleep screen; pause on leave; resume on return / reopen.
  useEffect(() => {
    if (!liveId) return;
    noteSleepPresence(onSleepScreen);
  }, [liveId, onSleepScreen]);

  // Off the sleep screen with a live night: track activity + idle, and
  // reconcile when the tab becomes visible again (covers the app being closed).
  useEffect(() => {
    if (!liveId || onSleepScreen) return;
    let last = 0;
    const onAct = () => {
      const t = Date.now();
      if (t - last < 12000) return;
      last = t;
      noteSleepPresence(false, t);
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') noteSleepPresence(false);
    };
    const scrollOpts: AddEventListenerOptions = { passive: true, capture: true };
    window.addEventListener('pointerdown', onAct, { passive: true });
    window.addEventListener('keydown', onAct);
    window.addEventListener('scroll', onAct, scrollOpts);
    document.addEventListener('visibilitychange', onVis);
    const iv = window.setInterval(() => reconcileSleep(), 30000);
    return () => {
      window.removeEventListener('pointerdown', onAct);
      window.removeEventListener('keydown', onAct);
      window.removeEventListener('scroll', onAct, scrollOpts);
      document.removeEventListener('visibilitychange', onVis);
      window.clearInterval(iv);
    };
  }, [liveId, onSleepScreen]);

  return null;
}
