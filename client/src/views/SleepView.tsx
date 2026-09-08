/**
 * Sleep overlay — the night hub, the honest wake flow, and the logged card.
 * Night mode (token flip + Spotter Sky) is applied app-wide by App while a live
 * night runs; this screen is the calm surface you land on.
 */
import { useState } from 'react';
import { useStore, liveSleep, stopSleep, setSleepQuality, latestWeight } from '../store';
import { useT, fmtDurationHuman } from '../i18n';
import { Icon } from '../ui';
import { moonInfo, illumPct } from '../moon';
import { nightDurationMin, lastNight } from '../sleep';
import { getUsername } from '../api';
import { bmrKcal } from '../energy';
import type { SleepQuality } from '../types';

function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
const dur = (min: number) => fmtDurationHuman(Math.max(0, min) * 60000);

export function SleepView({ onClose, wake }: { onClose: () => void; wake?: boolean }) {
  const { t } = useT();
  const store = useStore();
  const live = liveSleep(store.sleeps);
  const [now] = useState(() => Date.now());
  const [mode, setMode] = useState<'night' | 'wake' | 'logged'>(
    live ? (wake ? 'wake' : 'night') : 'logged',
  );
  const [loggedId, setLoggedId] = useState<string | null>(null);

  const moon = moonInfo(new Date(now));
  const goalMin = store.sleepSettings.goalMin || 480;

  // ---- night hub (SL-02/03) ----
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

  // ---- wake flow (SL-05) ----
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

  // ---- logged card (SL-06) ----
  const night =
    (loggedId && store.sleeps.find((n) => n.id === loggedId)) || lastNight(store.sleeps, now);
  if (!night) {
    return (
      <div className="screen sleep-screen">
        <p className="sleep-cap">{t.sleepNoLastNight}</p>
        <button className="btn-out-moon sleep-wide" onClick={onClose}>
          {t.done}
        </button>
      </div>
    );
  }
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
