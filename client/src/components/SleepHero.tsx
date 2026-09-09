/**
 * Sleep hero — the sleep counterpart to the live-session hero (LiveHero). While
 * a night is live but you're off the sleep screen, this slim band rides above
 * the router outlet on every screen so an open night is never invisible: it
 * shows the moon, the running (or paused) sleep timer, and taps back to the
 * night screen, with a Stop to wake. Same height/footprint as the compact
 * live-session hero; night-sky styling of its own.
 */
import { useEffect, useState } from 'react';
import type { SleepNight } from '../types';
import { useT, fmtDurationHuman } from '../i18n';
import { Icon } from '../ui';
import { MoonGlyph } from './MoonGlyph';
import { nightDurationMin, SLEEP_IDLE_MS } from '../sleep';

function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function SleepHero({
  night,
  onResume,
  onStop,
}: {
  night: SleepNight;
  onResume: () => void;
  onStop: () => void;
}) {
  const { t } = useT();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(iv);
  }, []);

  const mins = nightDurationMin(night, now);
  // Paused = an open awake interval that hasn't yet gone idle (you're actively
  // using the app off the sleep screen). Once idle past the threshold the night
  // counts again, so we no longer show it as paused.
  const paused =
    night.awakeSince != null && now - (night.lastSeen ?? night.awakeSince) < SLEEP_IDLE_MS;

  return (
    <div className={`live-hero sleep-hero${paused ? ' paused' : ''}`}>
      <div className="live-hero-bg sleep-hero-bg" aria-hidden="true">
        <MoonGlyph size={132} date={night.bedtime} halo={false} />
      </div>
      <div className="live-hero-scrim sleep-hero-scrim" />
      <button className="live-hero-body" onClick={onResume}>
        <div className="live-hero-line">
          <span className="live-dot" aria-hidden="true" />
          <span className="live-label">{paused ? t.sleepPausedLabel : t.sleepAsleepLabel}</span>
        </div>
        <div className="live-hero-stats">
          <span className="live-timer num">{fmtDurationHuman(mins * 60000)}</span>
          <span className="live-meta">
            {paused ? t.sleepPausedMeta : t.sleepSinceClock(hhmm(night.bedtime))}
          </span>
        </div>
      </button>
      <div className="live-hero-actions">
        <button
          className="live-resume icon-only sleep-hero-resume"
          onClick={onResume}
          aria-label={t.sleepReturnToNight}
          title={t.sleepReturnToNight}
        >
          <Icon name="moon-stars" weight="fill" />
        </button>
        <button className="sleep-hero-stop" onClick={onStop}>
          {t.sleepStopAction}
        </button>
      </div>
    </div>
  );
}
