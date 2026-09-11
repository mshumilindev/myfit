/**
 * Sleep overlay — routes between the live night flow (night hub → honest wake →
 * logged card) and, when awake, the record hub (history + rhythm), backfill and
 * schedule editors. Night mode (token flip + Spotter Sky) is applied app-wide by
 * App while a live night runs.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  useStore,
  liveSleep,
  stopSleep,
  cancelSleep,
  updateSleepNight,
  removeSleepNight,
  setSleepQuality,
  logSleepNight,
  setSleepSchedule,
  setSleepSettings,
  sleepDayId,
  latestWeight,
} from '../store';
import { useT, fmtDurationHuman } from '../i18n';
import { ConfirmDialog, Icon, Switch } from '../ui';
import { MoonGlyph } from '../components/MoonGlyph';
import { moonInfo, illumPct } from '../moon';
import { TimeField } from '../components/PickerFields';
import {
  nightDurationMin,
  lastNight,
  finishedNights,
  sleepStats,
  weekdayPattern,
  planDurationMin,
  sleepKindOf,
} from '../sleep';
import { getUsername } from '../api';
import { bmrKcal } from '../energy';
import type { SleepQuality, SleepDayPlan } from '../types';

function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function minToHHMM(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
function hhmmToMin(v: string): number {
  const [h, m] = v.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
const dur = (min: number) => fmtDurationHuman(Math.max(0, min) * 60000);
// Display order Mon…Sun mapped to JS getDay() (0 = Sun).
const WD_ORDER = [1, 2, 3, 4, 5, 6, 0];

function SleepTopbar({ title, onBack }: { title: string; onBack: () => void }) {
  const { t } = useT();
  return (
    <div className="sleep-topbar">
      <button className="sleep-back" onClick={onBack} aria-label={t.cancel}>
        <Icon name="caret-left" />
      </button>
      <span className="sleep-topbar-title">{title}</span>
    </div>
  );
}

export function SleepView({
  onClose,
  wake,
  mode: initialMode,
  nightId,
}: {
  onClose: () => void;
  wake?: boolean;
  mode?: 'backfill' | 'schedule' | 'edit';
  nightId?: string;
}) {
  const { t } = useT();
  const store = useStore();
  const live = liveSleep(store.sleeps);
  const [now] = useState(() => Date.now());
  const [mode, setMode] = useState<
    'night' | 'wake' | 'logged' | 'hub' | 'backfill' | 'schedule' | 'edit'
  >(initialMode ?? (live ? (wake ? 'wake' : 'night') : 'hub'));
  const [loggedId, setLoggedId] = useState<string | null>(null);
  const [tick, setTick] = useState(now);
  const [discardOpen, setDiscardOpen] = useState(false);
  // Live-tick the elapsed clock while asleep (once a minute is plenty).
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setTick(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, [live]);
  const moon = moonInfo(new Date(now));
  const goalMin = store.sleepSettings.goalMin || 480;

  if (mode === 'night' && live) {
    const mins = nightDurationMin(live, tick);
    return (
      <div className="screen sleep-night">
        <button className="sleep-night-back" onClick={onClose} aria-label={t.backAction}>
          <Icon name="caret-left" />
          <span>{t.sleepReturnToApp}</span>
        </button>
        <div className="sleep-night-body">
          <div className="sleep-moonwrap">
            <span className="sleep-breathe" aria-hidden="true" />
            <MoonGlyph size={104} date={now} halo={false} />
            <span className="sleep-z sleep-z1">z</span>
            <span className="sleep-z sleep-z2">z</span>
            <span className="sleep-z sleep-z3">z</span>
          </div>
          <div className="sleep-asleep-lbl">{t.sleepAsleepLabel}</div>
          <div className="sleep-elapsed num">{dur(mins)}</div>
          <div className="sleep-since-line">{t.sleepSinceClock(hhmm(live.bedtime))}</div>
          <div className="phase sleep-phase">
            <Icon name="moon-stars" weight="fill" />
            {t.sleepNightModeNote}
          </div>
        </div>
        <div className="sleep-night-foot">
          {t.sleepMoonLine(t.moonPhase[moon.name] ?? moon.name, illumPct(moon), tzPlace())}
        </div>
        <button className="btn-out-moon sleep-wide sleep-stop" onClick={() => setMode('wake')}>
          <Icon name="sun-horizon" weight="bold" />
          {t.sleepStopAction}
        </button>
        <button className="sleep-discard" onClick={() => setDiscardOpen(true)}>
          {t.sleepDiscard}
        </button>
        {discardOpen && (
          <ConfirmDialog
            title={t.sleepDiscard}
            body={t.sleepDiscardConfirm}
            confirmLabel={t.sleepDiscard}
            cancelLabel={t.cancel}
            danger
            onConfirm={() => {
              cancelSleep();
              onClose();
            }}
            onCancel={() => setDiscardOpen(false)}
          />
        )}
      </div>
    );
  }

  if (mode === 'wake' && live) {
    return (
      <WakeFlow
        bedtime={live.bedtime}
        onCancel={() => setMode('night')}
        onConfirm={(wakeAt) => {
          const n = stopSleep(wakeAt);
          setLoggedId(n?.id ?? null);
          setMode('logged');
        }}
      />
    );
  }

  if (mode === 'backfill') {
    const back = live ? onClose : () => setMode('hub');
    return <SleepBackfill onDone={() => setMode(live ? 'night' : 'hub')} onBack={back} />;
  }
  if (mode === 'schedule') {
    const back = live ? onClose : () => setMode('hub');
    return <SleepScheduleEditor onDone={() => setMode(live ? 'night' : 'hub')} onBack={back} />;
  }
  if (mode === 'edit' && nightId) {
    return <SleepEditNight nightId={nightId} onClose={onClose} />;
  }

  if (mode === 'logged') {
    const night =
      (loggedId && store.sleeps.find((n) => n.id === loggedId)) || lastNight(store.sleeps, now);
    if (night) {
      const mins = nightDurationMin(night, now);
      const pct = Math.min(100, Math.round((mins / goalMin) * 100));
      const isNap = sleepKindOf(night) === 'nap';
      const name = getUsername();
      const bmr = bmrKcal(store.bodyMetrics, latestWeight(store.bodyMetrics)?.weight, now);
      return (
        <div className="screen sleep-screen">
          <div className="sleep-logged-badge">
            <Icon name="check-circle" weight="fill" />
            {isNap ? t.sleepNapLogged : t.sleepLogged}
          </div>
          <h1 className="sleep-h1">
            {isNap ? t.sleepKindNap : name ? t.sleepGoodMorningName(name) : t.sleepWakeTitle}
          </h1>
          <div className="sleep-bignum num">{dur(mins)}</div>
          <div className="sleep-range">
            {hhmm(night.bedtime)} → {night.wake ? hhmm(night.wake) : ''}
          </div>
          {!isNap && (
            <div className="sleep-goalrow">
              <span>{t.sleepYourGoal(dur(goalMin))}</span>
              <span className="sleep-rhythm">{t.sleepOnRhythm(pct)}</span>
            </div>
          )}
          <div className="sleep-quality">
            <div className="sleep-q-head">
              {t.sleepHowDidYouSleep} <span className="sleep-q-opt">{t.sleepOptional}</span>
            </div>
            <div className="sleep-q-row">
              {(['restless', 'ok', 'good'] as SleepQuality[]).map((q) => (
                <button
                  key={q}
                  className={`sleep-q-chip${night.quality === q ? ' on' : ''}`}
                  onClick={() => setSleepQuality(night.id, night.quality === q ? null : q)}
                >
                  {t.sleepQuality[q]}
                </button>
              ))}
            </div>
          </div>
          {bmr && <div className="sleep-feeds">{t.sleepAlreadyFeeding}</div>}
          <button className="btn-moon sleep-wide" onClick={onClose}>
            {t.done}
          </button>
        </div>
      );
    }
  }

  // ---- hub / history (SL-12) ----
  return (
    <SleepHub
      now={now}
      onClose={onClose}
      onBackfill={() => setMode('backfill')}
      onSchedule={() => setMode('schedule')}
    />
  );
}

function SleepHub({
  now,
  onClose,
  onBackfill,
  onSchedule,
}: {
  now: number;
  onClose: () => void;
  onBackfill: () => void;
  onSchedule: () => void;
}) {
  const { t } = useT();
  const store = useStore();
  const goalMin = store.sleepSettings.goalMin || 480;
  const stats = sleepStats(store.sleeps, now, goalMin, 14);
  const pattern = weekdayPattern(store.sleeps, now);
  const last14 = finishedNights(store.sleeps, now).slice(0, 14).reverse();
  const maxDur = Math.max(goalMin, ...last14.map((n) => nightDurationMin(n, now)), 1);
  const deltaStr = stats.deltaVsPrevMin
    ? `${stats.deltaVsPrevMin > 0 ? '+' : ''}${dur(Math.abs(stats.deltaVsPrevMin))}`
    : '';
  const maxWd = Math.max(1, ...WD_ORDER.map((d) => pattern.byDay[d]?.durMin ?? 0));

  return (
    <div className="screen sleep-hub">
      <SleepTopbar title={t.sleepTitle} onBack={onClose} />
      {stats.nights === 0 ? (
        <p className="muted">{t.sleepEmptyHistory}</p>
      ) : (
        <>
          <div className="slh-stats">
            <div className="slh-stat">
              <div className="slh-stat-v num">{dur(stats.avgMin)}</div>
              <div className="slh-stat-l">{t.sleepAvgN(stats.nights)}</div>
              {deltaStr && <div className="slh-stat-d">{t.sleepDelta(deltaStr)}</div>}
            </div>
            <div className="slh-stat">
              <div className="slh-stat-v num">{stats.consistencyPct}%</div>
              <div className="slh-stat-l">{t.sleepConsistencyLabel}</div>
              <div className="slh-stat-d">{t.sleepBedWithin(30)}</div>
            </div>
          </div>

          <div className="slh-sec-label">{t.sleepLast14}</div>
          <div className="slh-bars">
            {last14.map((n) => {
              const m = nightDurationMin(n, now);
              return (
                <div key={n.id} className="slh-bar-col" title={dur(m)}>
                  <div className="slh-bar-track">
                    <div
                      className={`slh-bar${m >= goalMin ? ' met' : ''}`}
                      style={{ height: `${Math.round((m / maxDur) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="slh-goalmet">
            {t.sleepGoalMet(stats.goalMet, stats.nights, dur(goalMin))}
          </div>

          <div className="slh-sec-label">{t.sleepRhythmWeekday}</div>
          <div className="slh-rhythm">
            {WD_ORDER.map((d, i) => {
              const p = pattern.byDay[d];
              const wk = d === 0 || d === 6;
              return (
                <div key={d} className="slh-rcol">
                  <div className="slh-bar-track sm">
                    {p && (
                      <div
                        className={`slh-bar${wk ? ' wk' : ''}`}
                        style={{ height: `${Math.round((p.durMin / maxWd) * 100)}%` }}
                      />
                    )}
                  </div>
                  <div className={`slh-rwd${wk ? ' wk' : ''}`}>{t.weekDayLetters[i]}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="slh-toggles">
        <button
          className="slh-toggle"
          onClick={() => setSleepSettings({ autoDim: !store.sleepSettings.autoDim })}
        >
          <div className="slh-toggle-txt">
            <div className="slh-toggle-t">{t.sleepAutoDimLabel}</div>
            <div className="slh-toggle-d">{t.sleepAutoDimDesc}</div>
          </div>
          <Switch on={store.sleepSettings.autoDim} />
        </button>
        <button
          className="slh-toggle"
          onClick={() => setSleepSettings({ autoLog: !store.sleepSettings.autoLog })}
        >
          <div className="slh-toggle-txt">
            <div className="slh-toggle-t">{t.sleepAutoLogLabel}</div>
            <div className="slh-toggle-d">{t.sleepAutoLogDesc}</div>
          </div>
          <Switch on={store.sleepSettings.autoLog} />
        </button>
      </div>

      <button className="btn btn-secondary slh-btn" onClick={onBackfill}>
        <Icon name="plus" /> {t.sleepAddPastNight}
      </button>
      <button className="btn btn-secondary slh-btn" onClick={onSchedule}>
        <Icon name="calendar-check" /> {t.sleepScheduleTitle}
      </button>
    </div>
  );
}

function SleepBackfill({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { t, locale } = useT();
  // A backfilled entry is either a full night's sleep or a daytime nap, and you
  // pick the day AND time you fell asleep and the day AND time you woke — so a
  // sleep that crosses midnight (or a nap earlier today) is logged exactly.
  const [kind, setKind] = useState<'sleep' | 'nap'>('sleep');
  const [bedOffset, setBedOffset] = useState(1); // 1 = yesterday
  const [wakeOffset, setWakeOffset] = useState(0); // 0 = today
  const [bed, setBed] = useState('23:20');
  const [woke, setWoke] = useState('06:40');
  const [quality, setQuality] = useState<SleepQuality | null>(null);
  const days = [0, 1, 2, 3, 4, 5, 6];

  const pickKind = (k: 'sleep' | 'nap') => {
    setKind(k);
    if (k === 'nap') {
      setBedOffset(0);
      setWakeOffset(0);
      setBed('14:00');
      setWoke('14:45');
    } else {
      setBedOffset(1);
      setWakeOffset(0);
      setBed('23:20');
      setWoke('06:40');
    }
  };

  const atOffset = (offset: number, hhmm: string): number => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const [h, m] = hhmm.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  };
  const bedtime = atOffset(bedOffset, bed);
  const wake = atOffset(wakeOffset, woke);
  const valid = wake > bedtime;
  const mins = valid ? Math.round((wake - bedtime) / 60000) : 0;

  const save = () => {
    if (!valid) return;
    logSleepNight({ date: sleepDayId(wake), bedtime, wake, source: 'backfill', quality, kind });
    onDone();
  };

  const dayRow = (sel: number, set: (n: number) => void) => (
    <div className="sleep-daycards">
      {days.map((d) => {
        const dd = new Date();
        dd.setDate(dd.getDate() - d);
        return (
          <button
            key={d}
            className={`sleep-daycard${sel === d ? ' on' : ''}`}
            onClick={() => set(d)}
          >
            <span className="dc-wd">
              {d === 0 ? t.sleepTodayTag : dd.toLocaleDateString(locale, { weekday: 'short' })}
            </span>
            <span className="dc-day num">{dd.getDate()}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="screen sleep-hub sleep-backfill">
      <SleepTopbar title={t.sleepAddPastNight} onBack={onBack} />
      <p className="muted">{t.sleepBackfillHint}</p>

      <div className="slh-sec-label">{t.sleepKindLabel}</div>
      <div className="sleep-q-row">
        {(['sleep', 'nap'] as const).map((k) => (
          <button
            key={k}
            className={`sleep-q-chip${kind === k ? ' on' : ''}`}
            onClick={() => pickKind(k)}
          >
            {k === 'sleep' ? t.sleepKindSleep : t.sleepKindNap}
          </button>
        ))}
      </div>

      <div className="slh-sec-label">{t.sleepFellAsleep}</div>
      {dayRow(bedOffset, setBedOffset)}
      <div className="sleep-field-box sleep-backfill-time">
        <Icon name="moon" weight="fill" className="sleep-field-ic bed" />
        <input
          type="time"
          className="sleep-time-input"
          value={bed}
          onChange={(e) => setBed(e.target.value)}
        />
      </div>

      <div className="slh-sec-label">{t.sleepWokeUp}</div>
      {dayRow(wakeOffset, setWakeOffset)}
      <div className="sleep-field-box sleep-backfill-time">
        <Icon name="sun-horizon" weight="fill" className="sleep-field-ic woke" />
        <input
          type="time"
          className="sleep-time-input"
          value={woke}
          onChange={(e) => setWoke(e.target.value)}
        />
      </div>

      <div className="sleep-dur-card">
        <div className="slh-sec-label">{t.sleepDurationLabel}</div>
        {valid ? (
          <div className="sleep-dur-big num">{dur(mins)}</div>
        ) : (
          <div className="sleep-range-invalid">{t.sleepRangeInvalid}</div>
        )}
      </div>

      <div className="sleep-quality">
        <div className="sleep-q-head">
          {t.sleepHowDidYouSleep} <span className="sleep-q-opt">{t.sleepOptional}</span>
        </div>
        <div className="sleep-q-row">
          {(['restless', 'ok', 'good'] as SleepQuality[]).map((q) => (
            <button
              key={q}
              className={`sleep-q-chip${quality === q ? ' on' : ''}`}
              onClick={() => setQuality(quality === q ? null : q)}
            >
              {t.sleepQuality[q]}
            </button>
          ))}
        </div>
      </div>

      <button className="btn btn-primary slh-btn" onClick={save} disabled={!valid}>
        <Icon name="check" weight="bold" />
        {t.sleepSaveNight}
      </button>
    </div>
  );
}

function SleepScheduleEditor({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { t } = useT();
  const store = useStore();
  const [now] = useState(() => Date.now());
  // Seed only from what the user has actually given us: a saved schedule first,
  // then their own learned per-weekday rhythm, and only as a last resort a plain
  // neutral default (23:00 -> 07:00) that is obviously a starting point to edit.
  const pat = weekdayPattern(store.sleeps, now);
  const patDays = Object.entries(pat.byDay);
  const seedEvery: SleepDayPlan =
    store.sleepSchedule.every ??
    (patDays.length
      ? { bedMin: patDays[0][1]!.bedMin, wakeMin: patDays[0][1]!.wakeMin }
      : { bedMin: 1380, wakeMin: 420 });
  const seedByDay: Partial<Record<number, SleepDayPlan>> = Object.keys(store.sleepSchedule.byDay)
    .length
    ? { ...store.sleepSchedule.byDay }
    : Object.fromEntries(
        patDays.map(([d, pl]) => [Number(d), { bedMin: pl!.bedMin, wakeMin: pl!.wakeMin }]),
      );
  const [same, setSame] = useState(store.sleepSchedule.sameEveryNight);
  const [every, setEvery] = useState<SleepDayPlan>(seedEvery);
  const [byDay, setByDay] = useState<Partial<Record<number, SleepDayPlan>>>(seedByDay);

  const setDay = (d: number, patch: Partial<SleepDayPlan>) =>
    setByDay((prev) => ({
      ...prev,
      [d]: { ...(prev[d] ?? every), ...patch },
    }));

  const save = () => {
    setSleepSchedule({ sameEveryNight: same, every, byDay });
    onDone();
  };

  return (
    <div className="screen sleep-hub">
      <SleepTopbar title={t.sleepScheduleTitle} onBack={onBack} />
      <p className="muted">{t.sleepScheduleCap}</p>
      <button className="slh-toggle" onClick={() => setSame((v) => !v)}>
        <div className="slh-toggle-t">{t.sleepSameMostNights}</div>
        <Switch on={same} />
      </button>
      {same ? (
        <div className="slh-timerow">
          <label className="slh-timefield">
            <span>{t.sleepBedtimeLabel}</span>
            <input
              type="time"
              className="sleep-time-input"
              value={minToHHMM(every.bedMin)}
              onChange={(e) => setEvery((p) => ({ ...p, bedMin: hhmmToMin(e.target.value) }))}
            />
          </label>
          <label className="slh-timefield">
            <span>{t.sleepWokeLabel}</span>
            <input
              type="time"
              className="sleep-time-input"
              value={minToHHMM(every.wakeMin)}
              onChange={(e) => setEvery((p) => ({ ...p, wakeMin: hhmmToMin(e.target.value) }))}
            />
          </label>
        </div>
      ) : (
        <div className="slh-sched-rows">
          {WD_ORDER.map((d, i) => {
            const p = byDay[d] ?? every;
            return (
              <div key={d} className="slh-sched-row">
                <span className="slh-sched-wd">{t.weekDayLetters[i]}</span>
                <input
                  type="time"
                  className="sleep-time-input sm"
                  value={minToHHMM(p.bedMin)}
                  onChange={(e) => setDay(d, { bedMin: hhmmToMin(e.target.value) })}
                />
                <span className="slh-sched-arrow">→</span>
                <input
                  type="time"
                  className="sleep-time-input sm"
                  value={minToHHMM(p.wakeMin)}
                  onChange={(e) => setDay(d, { wakeMin: hhmmToMin(e.target.value) })}
                />
                <span className="slh-sched-dur">{dur(planDurationMin(p))}</span>
              </div>
            );
          })}
        </div>
      )}
      <button className="btn btn-primary slh-btn" onClick={save}>
        {t.sleepSaveSchedule}
      </button>
    </div>
  );
}

function WakeFlow({
  bedtime,
  onConfirm,
  onCancel,
}: {
  bedtime: number;
  onConfirm: (wakeAt: number) => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  const [now] = useState(() => Date.now());
  // Exact wake time via the app's own time picker (default: now).
  const [wake, setWake] = useState(() => hhmm(now));
  const wakeAt = useMemo(() => {
    const [h, m] = wake.split(':').map(Number);
    const d = new Date(now);
    d.setHours(h || 0, m || 0, 0, 0);
    let ts = d.getTime();
    // Land the chosen clock time on this night: after bedtime, and a morning
    // pick belongs to today (never more than half a day ahead of now).
    if (ts <= bedtime) ts += 86400000;
    if (ts > now + 12 * 3600000) ts -= 86400000;
    return ts;
  }, [wake, now, bedtime]);
  const mins = Math.round((wakeAt - bedtime) / 60000);
  return (
    <div className="screen sleep-screen">
      <h1 className="sleep-h1">{t.sleepWakeTitle}</h1>
      <p className="sleep-cap">{t.sleepWakeCap}</p>
      <div className="sleep-wake-dur num">{dur(mins)}</div>
      <div className="sleep-wake-about">
        {t.sleepWakeAbout(`${hhmm(bedtime)} → ${hhmm(wakeAt)}`)}
      </div>
      <div className="sleep-wake-field">
        <span className="slh-sec-label">{t.sleepWokeAtLabel}</span>
        <TimeField value={wake} onChange={setWake} />
      </div>
      <button className="btn-moon sleep-wide" onClick={() => onConfirm(wakeAt)}>
        {t.sleepLogAndWake(dur(mins))}
      </button>
      <button className="sleep-link" onClick={onCancel}>
        {t.cancel}
      </button>
    </div>
  );
}

function tzPlace(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    return tz.split('/').pop()?.replace(/_/g, ' ') || '';
  } catch {
    return '';
  }
}

/** Edit or delete a logged night (opened from the history timeline). Same
 *  styled fields + duration + quality as the backfill, minus the day picker
 *  (the night's date is fixed), plus a Delete. */
function SleepEditNight({ nightId, onClose }: { nightId: string; onClose: () => void }) {
  const { t, locale } = useT();
  const store = useStore();
  const night = store.sleeps.find((n) => n.id === nightId);
  const hh = (ms: number) => {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const [bed, setBed] = useState(night ? hh(night.bedtime) : '23:20');
  const [woke, setWoke] = useState(night && night.wake ? hh(night.wake) : '06:40');
  const [quality, setQuality] = useState<SleepQuality | null>(night?.quality ?? null);
  const [kind, setKind] = useState<'sleep' | 'nap'>(night ? sleepKindOf(night) : 'sleep');
  const [confirmDel, setConfirmDel] = useState(false);

  if (!night) {
    onClose();
    return null;
  }

  const bedDay = new Date(night.bedtime);
  const build = () => {
    const [bh, bm] = bed.split(':').map(Number);
    const b = new Date(bedDay);
    b.setHours(bh, bm, 0, 0);
    const bedtime = b.getTime();
    const [wh, wm] = woke.split(':').map(Number);
    const w = new Date(bedtime);
    w.setHours(wh, wm, 0, 0);
    let wk = w.getTime();
    if (wk <= bedtime) wk += 86400000;
    return { bedtime, wake: wk };
  };
  const built = build();
  const mins = Math.round((built.wake - built.bedtime) / 60000);
  const nightOf = new Date(night.bedtime).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const save = () => {
    updateSleepNight(night.id, { ...built, date: sleepDayId(built.wake), quality, kind });
    onClose();
  };

  return (
    <div className="screen sleep-hub sleep-backfill">
      <SleepTopbar title={t.sleepEditNight} onBack={onClose} />
      <div className="sleep-nightof">
        <Icon name={kind === 'nap' ? 'sun-horizon' : 'moon'} weight="fill" />
        {t.sleepNightOf(nightOf)}
      </div>

      <div className="sleep-quality">
        <div className="sleep-q-head">{t.sleepKindLabel}</div>
        <div className="sleep-q-row">
          <button
            className={`sleep-q-chip${kind === 'sleep' ? ' on' : ''}`}
            onClick={() => setKind('sleep')}
          >
            {t.sleepKindSleep}
          </button>
          <button
            className={`sleep-q-chip${kind === 'nap' ? ' on' : ''}`}
            onClick={() => setKind('nap')}
          >
            {t.sleepKindNap}
          </button>
        </div>
      </div>

      <div className="slh-timerow">
        <label className="slh-timefield">
          <span className="slh-sec-label">{t.sleepBedtimeLabel}</span>
          <div className="sleep-field-box">
            <Icon name="moon" weight="fill" className="sleep-field-ic bed" />
            <input
              type="time"
              className="sleep-time-input"
              value={bed}
              onChange={(e) => setBed(e.target.value)}
            />
          </div>
        </label>
        <label className="slh-timefield">
          <span className="slh-sec-label">{t.sleepWokeLabel}</span>
          <div className="sleep-field-box">
            <Icon name="sun-horizon" weight="fill" className="sleep-field-ic woke" />
            <input
              type="time"
              className="sleep-time-input"
              value={woke}
              onChange={(e) => setWoke(e.target.value)}
            />
          </div>
        </label>
      </div>

      <div className="sleep-dur-card">
        <div className="slh-sec-label">{t.sleepDurationLabel}</div>
        <div className="sleep-dur-big num">{dur(mins)}</div>
      </div>

      <div className="sleep-quality">
        <div className="sleep-q-head">
          {t.sleepHowDidYouSleep} <span className="sleep-q-opt">{t.sleepOptional}</span>
        </div>
        <div className="sleep-q-row">
          {(['restless', 'ok', 'good'] as SleepQuality[]).map((q) => (
            <button
              key={q}
              className={`sleep-q-chip${quality === q ? ' on' : ''}`}
              onClick={() => setQuality(quality === q ? null : q)}
            >
              {t.sleepQuality[q]}
            </button>
          ))}
        </div>
      </div>

      <button className="btn btn-primary slh-btn" onClick={save}>
        <Icon name="check" weight="bold" />
        {t.sleepSaveNight}
      </button>
      <button className="sleep-delete-link" onClick={() => setConfirmDel(true)}>
        <Icon name="trash" weight="bold" />
        {t.sleepDeleteNight}
      </button>
      {confirmDel && (
        <ConfirmDialog
          title={t.sleepDeleteNight}
          body={t.sleepDeleteConfirm}
          confirmLabel={t.sleepDeleteNight}
          cancelLabel={t.cancel}
          danger
          onConfirm={() => {
            removeSleepNight(night.id);
            onClose();
          }}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </div>
  );
}
