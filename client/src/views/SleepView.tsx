/**
 * Sleep overlay — routes between the live night flow (night hub → honest wake →
 * logged card) and, when awake, the record hub (history + rhythm), backfill and
 * schedule editors. Night mode (token flip + Spotter Sky) is applied app-wide by
 * App while a live night runs.
 */
import { useEffect, useState } from 'react';
import {
  useStore,
  liveSleep,
  stopSleep,
  cancelSleep,
  setSleepQuality,
  logSleepNight,
  setSleepSchedule,
  setSleepSettings,
  sleepDayId,
  latestWeight,
} from '../store';
import { useT, fmtDurationHuman } from '../i18n';
import { Icon, Switch } from '../ui';
import { MoonGlyph } from '../components/MoonGlyph';
import { moonInfo, illumPct } from '../moon';
import {
  nightDurationMin,
  lastNight,
  finishedNights,
  sleepStats,
  weekdayPattern,
  planDurationMin,
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
}: {
  onClose: () => void;
  wake?: boolean;
  mode?: 'backfill' | 'schedule';
}) {
  const { t } = useT();
  const store = useStore();
  const live = liveSleep(store.sleeps);
  const [now] = useState(() => Date.now());
  const [mode, setMode] = useState<'night' | 'wake' | 'logged' | 'hub' | 'backfill' | 'schedule'>(
    live ? (wake ? 'wake' : 'night') : (initialMode ?? 'hub'),
  );
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
        {discardOpen ? (
          <div className="sleep-discard-confirm">
            <span className="sleep-discard-q">{t.sleepDiscardConfirm}</span>
            <div className="sleep-discard-row">
              <button
                className="sleep-discard-yes"
                onClick={() => {
                  cancelSleep();
                  onClose();
                }}
              >
                {t.sleepDiscard}
              </button>
              <button className="sleep-discard-no" onClick={() => setDiscardOpen(false)}>
                {t.cancel}
              </button>
            </div>
          </div>
        ) : (
          <button className="sleep-discard" onClick={() => setDiscardOpen(true)}>
            {t.sleepDiscard}
          </button>
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

  if (mode === 'logged') {
    const night =
      (loggedId && store.sleeps.find((n) => n.id === loggedId)) || lastNight(store.sleeps, now);
    if (night) {
      const mins = nightDurationMin(night, now);
      const pct = Math.min(100, Math.round((mins / goalMin) * 100));
      const name = getUsername();
      const bmr = bmrKcal(store.bodyMetrics, latestWeight(store.bodyMetrics)?.weight, now);
      return (
        <div className="screen sleep-screen">
          <div className="sleep-logged-badge">
            <Icon name="check-circle" weight="fill" />
            {t.sleepLogged}
          </div>
          <h1 className="sleep-h1">{name ? t.sleepGoodMorningName(name) : t.sleepWakeTitle}</h1>
          <div className="sleep-bignum num">{dur(mins)}</div>
          <div className="sleep-range">
            {hhmm(night.bedtime)} → {night.wake ? hhmm(night.wake) : ''}
          </div>
          <div className="sleep-goalrow">
            <span>{t.sleepYourGoal(dur(goalMin))}</span>
            <span className="sleep-rhythm">{t.sleepOnRhythm(pct)}</span>
          </div>
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
  const [dayOffset, setDayOffset] = useState(1); // 1 = last night
  const [bed, setBed] = useState('23:20');
  const [woke, setWoke] = useState('06:40');
  const [quality, setQuality] = useState<SleepQuality | null>(null);
  const days = [1, 2, 3, 4, 5];

  function build(): { bedtime: number; wake: number; date: string } {
    const bedDay = new Date();
    bedDay.setDate(bedDay.getDate() - dayOffset);
    const [bh, bm] = bed.split(':').map(Number);
    bedDay.setHours(bh, bm, 0, 0);
    const bedtime = bedDay.getTime();
    const [wh, wm] = woke.split(':').map(Number);
    const wakeD = new Date(bedtime);
    wakeD.setHours(wh, wm, 0, 0);
    let wake = wakeD.getTime();
    if (wake <= bedtime) wake += 86400000;
    return { bedtime, wake, date: sleepDayId(wake) };
  }
  const built = build();
  const mins = Math.round((built.wake - built.bedtime) / 60000);
  const nightOf = new Date(built.bedtime).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const save = () => {
    logSleepNight({ ...built, source: 'backfill', quality });
    onDone();
  };

  return (
    <div className="screen sleep-hub sleep-backfill">
      <SleepTopbar title={t.sleepAddPastNight} onBack={onBack} />
      <p className="muted">{t.sleepBackfillHint}</p>

      <div className="slh-sec-label">{t.sleepWhichNight}</div>
      <div className="sleep-daycards">
        {days.map((d) => {
          const dd = new Date();
          dd.setDate(dd.getDate() - d);
          return (
            <button
              key={d}
              className={`sleep-daycard${dayOffset === d ? ' on' : ''}`}
              onClick={() => setDayOffset(d)}
            >
              <span className="dc-wd">{dd.toLocaleDateString(locale, { weekday: 'short' })}</span>
              <span className="dc-day num">{dd.getDate()}</span>
            </button>
          );
        })}
      </div>
      <div className="sleep-nightof">
        <Icon name="moon" weight="fill" />
        {t.sleepNightOf(nightOf)}
        {dayOffset === 1 && <span className="dc-tag">{t.sleepLastNightTag}</span>}
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
  const [wakeAt, setWakeAt] = useState(now);
  const [exact, setExact] = useState(false);
  const mins = Math.round((wakeAt - bedtime) / 60000);
  const chips: Array<{ label: string; at: number }> = [
    { label: t.sleepWokeJustNow, at: now },
    { label: t.sleepWokeAgo(15), at: now - 15 * 60000 },
    { label: t.sleepWokeAgo(30), at: now - 30 * 60000 },
    { label: t.sleepWokeHrAgo(1), at: now - 60 * 60000 },
  ];
  return (
    <div className="screen sleep-screen">
      <h1 className="sleep-h1">{t.sleepWakeTitle}</h1>
      <p className="sleep-cap">{t.sleepWakeCap}</p>
      <div className="sleep-wake-dur num">{dur(mins)}</div>
      <div className="sleep-wake-about">
        {t.sleepWakeAbout(`${hhmm(bedtime)} → ${hhmm(wakeAt)}`)}
      </div>
      <div className="sleep-chip-grid">
        {chips.map((c) => (
          <button
            key={c.label}
            className={`sleep-chip${Math.abs(c.at - wakeAt) < 30000 && !exact ? ' on' : ''}`}
            onClick={() => {
              setExact(false);
              setWakeAt(c.at);
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
      <button className="sleep-exact-toggle" onClick={() => setExact((x) => !x)}>
        <Icon name="clock" /> {t.sleepSetExact}
      </button>
      {exact && (
        <input
          type="time"
          className="sleep-time-input"
          defaultValue={hhmm(wakeAt)}
          onChange={(e) => {
            const [h, m] = e.target.value.split(':').map(Number);
            const d = new Date(now);
            d.setHours(h, m, 0, 0);
            let ts = d.getTime();
            if (ts < bedtime) ts += 86400000;
            setWakeAt(ts);
          }}
        />
      )}
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
