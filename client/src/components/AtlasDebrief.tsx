/**
 * Atlas's debrief on the session summary: what this session says about you,
 * in his temper — the same facts that land in his notes feed.
 */
import { useAddonOrBase } from '../addons/enabledSet';
import { useSleepsForCalc } from '../addons/useSleeps';
import { Chip } from './ui/Chip';
import { useMemo } from 'react';
import { useT } from '../i18n';
import { setCoach, useStore } from '../store';
import type { Workout } from '../types';
import { sessionFacts } from '../atlas/facts';
import { effectiveTemper, swearingNow } from '../atlas/guard';
import { say } from '../atlas/voice';
import { useAtlasFmt } from '../atlas/notes';
import { TEMPER_COLOR } from '../atlas/types';
import { AtlasFace } from './AtlasFace';

export function AtlasDebrief({ workout, onOpen }: { workout: Workout; onOpen: () => void }) {
  const { t, locale } = useT();
  const s = useStore();
  const fmt = useAtlasFmt();
  const atlasOn = useAddonOrBase('atlas');
  const sleeps = useSleepsForCalc();
  const lines = useMemo(() => {
    if (!atlasOn || !s.coach.enabled) return null;
    const finished = s.workouts.filter((w) => w.finishedAt !== null);
    const now = workout.finishedAt ?? workout.startedAt;
    const gctx = {
      injuries: s.injuries,
      restPeriods: s.restPeriods,
      sleeps,
      finished: finished.filter((w) => w.id !== workout.id),
      now,
      dob: s.bodyMetrics?.dob,
    };
    const temper = effectiveTemper(s.coach, gctx);
    const swearing = swearingNow(s.coach, gctx);
    const texts = sessionFacts(workout, finished).map((f) =>
      say(f, temper, { locale, fmt, yoMama: s.coach.yoMama, swearing }),
    );
    return { temper, texts };
  }, [
    atlasOn,
    s.coach,
    s.workouts,
    s.injuries,
    s.restPeriods,
    sleeps,
    s.bodyMetrics,
    workout,
    locale,
    fmt,
  ]);
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
          <Chip tone="atlas" onClick={() => setCoach({ mutedUntil: endOfDay })}>
            {t.atlasMuteToday}
          </Chip>
        )}
        <Chip tone="atlas" selected onClick={onOpen}>
          {t.atlasOpen}
        </Chip>
      </div>
    </div>
  );
}
