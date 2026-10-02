/**
 * Activity hero — the live-session hero's counterpart while an activity timer
 * runs (or is paused). Same slim band as the workout / home-set hero, riding
 * above the router outlet on every screen but the activity page, so a running
 * timer is never invisible. It wears its category's colour (conditioning orchid,
 * recovery blue, sport green) and background; tap
 * to return to the activity, or pause / resume right from the band.
 */
import { useEffect, useState } from 'react';
import type { Activity } from '../types';
import { fmtSessionClock, useT } from '../i18n';
import { Card } from './ui/Card';
import { IconButton } from './ui/Button';
import { BackButton } from './ui/BackButton';
import { activityElapsedMs, activityTone, activityType, isActivityPaused } from '../activities';
import { pauseActivity, resumeActivity } from '../store';

export function ActivityHero({
  activity,
  onOpen,
  onBack,
}: {
  activity: Activity;
  /** Band mode: tap opens the activity; pause / open buttons on the right. */
  onOpen?: () => void;
  /** Screen mode (inside the activity page): back button, no actions. */
  onBack?: () => void;
}) {
  const { t } = useT();
  const paused = isActivityPaused(activity);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (paused) return;
    const iv = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(iv);
  }, [paused]);

  const type = activityType(activity.type);
  const tone = activityTone(activity.type, activity.category);
  const name = type ? (t.actType[type.key] ?? type.key) : activity.type;
  const recovery = activity.category === 'recovery';
  const label = paused ? `${t.actPaused} · ${name}` : `${t.liveLabel} · ${name}`;
  const meta = recovery ? t.actCountsRecovery : t.actAddsConditioning;
  const elapsed = activityElapsedMs(activity, paused ? (activity.accumulatedMs ?? 0) : now);

  return (
    <div
      className={`live-hero activity-live-hero cat-${tone}${paused ? ' paused' : ''}${onBack ? ' is-screen' : ''}`}
    >
      <div className="live-hero-scrim activity-hero-scrim" />
      {onBack && (
        <div className="av-hero-back">
          <BackButton onClick={onBack} label={t.backAction} />
        </div>
      )}
      <Card
        as={onBack ? 'div' : 'button'}
        pad="none"
        emphasis="quiet"
        className="live-hero-body"
        onClick={onOpen}
      >
        <div className="live-hero-line">
          <span className="live-dot" aria-hidden="true" />
          <span className="live-label">{label}</span>
        </div>
        <div className="live-hero-stats">
          <span className="live-timer num">{fmtSessionClock(elapsed)}</span>
          <span className="live-meta">{meta}</span>
        </div>
      </Card>
      {!onBack && onOpen && (
        <div className="live-hero-actions">
          <IconButton
            icon={paused ? 'play' : 'pause'}
            variant="secondary"
            label={paused ? t.actResume : t.actPause}
            title={paused ? t.actResume : t.actPause}
            onClick={() => (paused ? resumeActivity(activity.id) : pauseActivity(activity.id))}
          />
          <IconButton
            icon="arrow-right"
            variant="primary"
            label={t.openAction}
            title={t.openAction}
            onClick={onOpen}
          />
        </div>
      )}
    </div>
  );
}
