/**
 * Readiness coach (feature #1). Reads each muscle on its own recovery clock
 * (recovery.ts) and turns it into a daily read: what's recovered, what's still
 * cooking, what's ready-and-behind. Lives as one card in the Today nudge stack;
 * `buildReadinessNudge` produces that card, `ReadinessBody` is its full content
 * (the body map, the per-muscle list and one recommendation).
 */
import { Icon } from '../ui';
import { useT } from '../i18n';
import { MuscleHeatmap, MuscleIcon } from './Muscle';
import {
  muscleReadiness,
  readinessColors,
  readinessMood,
  recoveringMuscles,
  readyMuscles,
  staleMuscles,
  READINESS_COLOR,
  type MuscleReadiness,
} from '../recovery';
import type { Nudge } from './NudgeStack';
import type { Workout } from '../types';
import type { MuscleGroup } from '../data/exercises';

type T = ReturnType<typeof useT>['t'];
const round = (n: number): number => Math.round(n);

function verdict(
  map: Map<MuscleGroup, MuscleReadiness>,
  t: T,
): { lead: string; why: string | null } {
  const mood = readinessMood(map);
  const ready = readyMuscles(map)
    .filter((m) => map.get(m)?.state === 'ready')
    .slice(0, 3)
    .map((m) => t.muscleGroups[m]);
  const cooling = recoveringMuscles(map)
    .slice(0, 3)
    .map((r) => t.muscleGroups[r.muscle]);
  if (mood === 'fresh') return { lead: t.rdFreshLead, why: null };
  if (mood === 'cooked') {
    return {
      lead: t.rdCookedLead,
      why: cooling.length ? t.rdCoolingWhy(cooling.join(' · ')) : null,
    };
  }
  return {
    lead: ready.length ? t.rdMixedLead(ready.join(' · ')) : t.rdMixedBare,
    why: cooling.length ? t.rdCoolingWhy(cooling.join(' · ')) : null,
  };
}

function daysLabel(r: MuscleReadiness, t: T): string {
  if (r.daysSince === null) return t.rdBehind;
  if (r.readiness >= 1) return r.state === 'stale' ? t.rdBehind : t.rdReadyNow;
  const left = Math.max(1, Math.ceil(r.recoveryDays - r.daysSince));
  return t.rdReadyIn(left);
}

/** Ordered for the read: what's cooking first, then ready, then behind. */
function orderedRows(map: Map<MuscleGroup, MuscleReadiness>): MuscleReadiness[] {
  const rank: Record<string, number> = { recovering: 0, nearly: 1, stale: 2, ready: 3 };
  return [...map.values()]
    .filter((r) => r.daysSince !== null)
    .sort((a, b) => rank[a.state] - rank[b.state] || a.readiness - b.readiness);
}

function ReadinessRow({ r }: { r: MuscleReadiness }) {
  const { t } = useT();
  return (
    <div className="rd-row">
      <MuscleIcon
        muscle={r.muscle}
        variant="row"
        tone={r.daysSince === null ? 'muted' : 'primary'}
      />
      <span className="rd-name">{t.muscleGroups[r.muscle]}</span>
      <span className="rd-days tnum">{daysLabel(r, t)}</span>
      <span className="rd-badge">
        <span className="rd-bar">
          <span
            className="rd-bar-fill"
            style={{ width: `${round(r.readiness * 100)}%`, background: READINESS_COLOR[r.state] }}
          />
        </span>
        <em className="tnum" style={{ color: READINESS_COLOR[r.state] }}>
          {round(r.readiness * 100)}%
        </em>
      </span>
    </div>
  );
}

/** The full readiness read — body of the readiness nudge. */
export function ReadinessBody({ map }: { map: Map<MuscleGroup, MuscleReadiness> }) {
  const { t } = useT();
  const v = verdict(map, t);
  const rows = orderedRows(map);
  const stale = staleMuscles(map)
    .slice(0, 3)
    .map((r) => t.muscleGroups[r.muscle]);
  const ready = readyMuscles(map)
    .filter((m) => map.get(m)?.state === 'ready')
    .slice(0, 3)
    .map((m) => t.muscleGroups[m]);
  const reco = ready.length ? ready : stale;
  return (
    <div className="rd-full">
      {v.why && <div className="rd-why">{v.why}</div>}
      <MuscleHeatmap colors={readinessColors(map)} className="rd-map" />
      <div className="rd-legend">
        {(['recovering', 'nearly', 'ready', 'stale'] as const).map((s) => (
          <span key={s} className="rd-leg">
            <span className="sw" style={{ background: READINESS_COLOR[s] }} />
            {t.rdState[s]}
          </span>
        ))}
      </div>
      <div className="rd-list">
        {rows.map((r) => (
          <ReadinessRow key={r.muscle} r={r} />
        ))}
      </div>
      {reco.length > 0 && (
        <div className="rd-reco">
          <Icon name="check-circle" weight="fill" />
          <span>{t.rdReco(reco.join(' · '))}</span>
        </div>
      )}
    </div>
  );
}

/** Build the readiness nudge, or null on a cold start (too little history). */
export function buildReadinessNudge(finished: Workout[], now: number, t: T): Nudge | null {
  const map = muscleReadiness(finished, now);
  const trained = [...map.values()].filter((r) => r.daysSince !== null);
  if (trained.length < 3) return null;
  return {
    id: 'readiness',
    tone: 'readiness',
    icon: 'heartbeat',
    kicker: t.readinessKicker,
    title: verdict(map, t).lead,
    body: <ReadinessBody map={map} />,
  };
}
