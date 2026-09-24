/**
 * Atlas's debrief on the session summary: what this session says about you,
 * in his temper — the same facts that land in his notes feed.
 */
import { useMemo } from 'react';
import { useT } from '../i18n';
import { setCoach, useStore } from '../store';
import type { Workout } from '../types';
import { sessionFacts } from '../atlas/facts';
import { effectiveTemper } from '../atlas/guard';
import { say } from '../atlas/voice';
import { useAtlasFmt } from '../atlas/notes';
import { TEMPER_COLOR } from '../atlas/types';
import { AtlasFace } from './AtlasFace';

export function AtlasDebrief({ workout, onOpen }: { workout: Workout; onOpen: () => void }) {
  const { t, locale } = useT();
  const s = useStore();
  const fmt = useAtlasFmt();
  const lines = useMemo(() => {
    if (!s.coach.enabled) return null;
    const finished = s.workouts.filter((w) => w.finishedAt !== null);
    const now = workout.finishedAt ?? workout.startedAt;
    const temper = effectiveTemper(s.coach, {
      injuries: s.injuries,
      restPeriods: s.restPeriods,
      sleeps: s.sleeps,
      finished: finished.filter((w) => w.id !== workout.id),
      now,
    });
    const texts = sessionFacts(workout, finished).map((f) =>
      say(f, temper, { locale, fmt, yoMama: s.coach.yoMama }),
    );
    return { temper, texts };
  }, [s.coach, s.workouts, s.injuries, s.restPeriods, s.sleeps, workout, locale, fmt]);
  if (!lines || lines.texts.length === 0) return null;
  const { temper, texts } = lines;
  const endOfDay = new Date(workout.finishedAt ?? workout.startedAt).setHours(23, 59, 59, 999);
  const muted = (s.coach.mutedUntil ?? 0) > (workout.finishedAt ?? 0);
  return (
    <div className="atl-debrief" style={{ ['--atl' as string]: TEMPER_COLOR[temper] }}>
      {texts.map((text, i) => (
        <div key={i} className="atl-say">
          <AtlasFace temper={temper} size={28} />
          <div className="atl-bubble">{text}</div>
        </div>
      ))}
      <div className="atl-replies">
        {!muted && temper >= 4 && (
          <button className="atl-chip" onClick={() => setCoach({ mutedUntil: endOfDay })}>
            {t.atlasMuteToday}
          </button>
        )}
        <button className="atl-chip on" onClick={onOpen}>
          {t.atlasOpen}
        </button>
      </div>
    </div>
  );
}
