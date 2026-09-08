/**
 * Sleep overlay — routes between the live night flow (night hub → honest wake →
 * logged card) and, when awake, the record hub (history + rhythm), backfill and
 * schedule editors. Night mode (token flip + Spotter Sky) is applied app-wide by
 * App while a live night runs.
 */
import { useState } from 'react';
import {
  useStore,
  liveSleep,
  stopSleep,
  setSleepQuality,
  logSleepNight,
  setSleepSchedule,
  setSleepSettings,
  sleepDayId,
  latestWeight,
} from '../store';
import { useT, fmtDurationHuman } from '../i18n';
import { Icon, Switch } from '../ui';
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
  const moon = moonInfo(new Date(now));
  const goalMin = store.sleepSettings.goalMin || 480;

  if (mode === 'night' && live) {
    const mins = nightDurationMin(live, now);
    return (
      <div className="screen sleep-screen">
        <div className="sleep-moonline">
          {t.sleepMoonLine(t.moonPhase[moon.name] ?? moon.name, illumPct(moon), tzPlace())}
        </div>
        <div className="sleep-hero">
          <div className="sleep-zz">z z z</div>
          <h1 className="sleep-h1">{t.sleepGoodNight}</h1>
          <p className="sleep-cap">{t.sleepRestingToo}</p>
          <div className="sleep-since">{t.sleepAsleepFor(dur(mins), hhmm(live.bedtime))}</div>
          <div className="sleep-note">{t.sleepNightModeNote}</div>
        </div>
        <button className="btn-out-moon sleep-wide" onClick={() => setMode('wake')}>
          {t.sleepStopAction}
        </button>
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
    return <SleepBackfill onDone={() => setMode('hub')} onClose={onClose} />;
  }
  if (mode === 'schedule') {
    return <SleepScheduleEditor onDone={() => setMode('hub')} />;
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
      onBackfill={() => setMode('backfill')}
      onSchedule={() => setMode('schedule')}
    />
  );
}

function SleepHub({
  now,
  onBackfill,
  onSchedule,
}: {
  now: number;
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
      <h2 className="title-26">{t.sleepTitle}</h2>
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
              return (
                <div key={d} className="slh-rcol">
                  <div className="slh-bar-track sm">
                    {p && (
                      <div
                        className="slh-bar"
                        style={{ height: `${Math.round((p.durMin / maxWd) * 100)}%` }}
                      />
                    )}
                  </div>
                  <div className="slh-rwd">{t.weekDayLetters[i]}</div>
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

function SleepBackfill({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const { t, locale } = useT();
  const [dayOffset, setDayOffset] = useState(1); // 1 = last night
  const [bed, setBed] = useState('23:20');
  const [woke, setWoke] = useState('06:40');
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

  const save = () => {
    logSleepNight({ ...built, source: 'backfill' });
    onDone();
  };

  return (
    <div className="screen sleep-hub">
      <h2 className="title-26">{t.sleepAddPastNight}</h2>
      <p className="muted">{t.sleepWhichNight}</p>
      <div className="slh-daychips">
        {days.map((d) => {
          const dd = new Date();
          dd.setDate(dd.getDate() - d);
          const label = dd.toLocaleDateString(locale, {
            weekday: 'short',
            day: 'numeric',
          });
          return (
            <button
              key={d}
              className={`sleep-chip${dayOffset === d ? ' on' : ''}`}
              onClick={() => setDayOffset(d)}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="slh-timerow">
        <label className="slh-timefield">
          <span>{t.sleepBedtimeLabel}</span>
          <input
            type="time"
            className="sleep-time-input"
            value={bed}
            onChange={(e) => setBed(e.target.value)}
          />
        </label>
        <label className="slh-timefield">
          <span>{t.sleepWokeLabel}</span>
          <input
            type="time"
            className="sleep-time-input"
            value={woke}
            onChange={(e) => setWoke(e.target.value)}
          />
        </label>
      </div>
      <div className="slh-dur num">{dur(mins)}</div>
      <button className="btn btn-primary slh-btn" onClick={save}>
        {t.sleepSaveNight}
      </button>
      <button className="sleep-link" onClick={onClose}>
        {t.cancel}
      </button>
    </div>
  );
}

function SleepScheduleEditor({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  const store = useStore();
  const [same, setSame] = useState(store.sleepSchedule.sameEveryNight);
  const [every, setEvery] = useState<SleepDayPlan>(
    store.sleepSchedule.every ?? { bedMin: 1400, wakeMin: 400 },
  );
  const [byDay, setByDay] = useState<Partial<Record<number, SleepDayPlan>>>({
    ...store.sleepSchedule.byDay,
  });

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
      <h2 className="title-26">{t.sleepScheduleTitle}</h2>
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
