/**
 * Readiness coach (feature #1). Reads each muscle on its own recovery clock
 * (recovery.ts) and turns it into a daily read: what's recovered, what's still
 * cooking, what's ready-and-behind. A compact card on Today (verdict + a strip
 * of the most relevant muscles) whose "Full read" opens the Progress readiness
 * lens; `ReadinessLens` is that full body-map read.
 */
import { useLayoutEffect, useRef } from 'react';
import { Icon } from '../ui';
import { useT } from '../i18n';
import { MuscleHeatmap, MuscleIcon } from './Muscle';
import type { Nudge } from './NudgeStack';
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
import type { Workout } from '../types';
import type { MuscleGroup } from '../data/exercises';

/** Deep link to the Progress → Volume → Readiness lens. */
export const READINESS_LENS_HASH = '#/progress/volume/readiness';

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

/** Chips + a trailing "Full read"; chips that don't fit drop from the end so the
 *  row never ends on a half-clipped chip and never scrolls. Full read opens the
 *  Progress readiness lens. */
function ReadinessStrip({ rows }: { rows: MuscleReadiness[] }) {
  const { t } = useT();
  const ref = useRef<HTMLDivElement>(null);
  const key = rows.map((r) => r.muscle).join(',');
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const chips = Array.from(el.querySelectorAll<HTMLElement>('[data-chip]'));
      chips.forEach((c) => (c.style.display = ''));
      for (let i = chips.length - 1; i >= 0 && el.scrollWidth > el.clientWidth; i--) {
        chips[i].style.display = 'none';
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [key]);
  return (
    <div className="rd-strip" ref={ref}>
      {rows.map((r) => (
        <span key={r.muscle} className="rd-chip" data-chip>
          <MuscleIcon
            muscle={r.muscle}
            variant="row"
            tone={r.daysSince === null ? 'muted' : 'primary'}
          />
          <span className="rd-chip-name">{t.muscleGroups[r.muscle]}</span>
          <span className="rd-chip-pct tnum" style={{ color: READINESS_COLOR[r.state] }}>
            {round(r.readiness * 100)}%
          </span>
        </span>
      ))}
    </div>
  );
}

/** Body of the readiness nudge — the compact read it had as a standalone card:
 *  the ready/recovering counts and a strip of the most relevant muscles, with
 *  "Full read" into the Progress readiness lens. */
function ReadinessNudgeBody({ finished, now }: { finished: Workout[]; now: number }) {
  const { t } = useT();
  const map = muscleReadiness(finished, now);
  const readyN = readyMuscles(map).filter((m) => map.get(m)?.state === 'ready').length;
  const cooling = recoveringMuscles(map).length;
  const strip = orderedRows(map).slice(0, 8);
  return (
    <div className="rd-nudge">
      <div className="rd-counts tnum">
        {t.rdReadyN(readyN)} · {t.rdCoolingN(cooling)}
      </div>
      <ReadinessStrip rows={strip} />
    </div>
  );
}

/** Build the readiness nudge for the Today stack, or null on a cold start.
 *  Expands to the per-muscle read; "Full read" opens the Progress readiness lens. */
export function buildReadinessNudge(finished: Workout[], now: number, t: T): Nudge | null {
  const map = muscleReadiness(finished, now);
  const trained = [...map.values()].filter((r) => r.daysSince !== null);
  if (trained.length < 3) return null;
  return {
    id: 'readiness',
    tone: 'readiness',
    priority: 80,
    icon: 'heartbeat',
    kicker: t.readinessKicker,
    title: verdict(map, t).lead,
    body: <ReadinessNudgeBody finished={finished} now={now} />,
    actions: (close) => (
      <button
        className="prog-banner-cta"
        onClick={() => {
          window.location.hash = READINESS_LENS_HASH;
          close();
        }}
      >
        {t.rdDetails}
        <Icon name="caret-right" weight="bold" />
      </button>
    ),
  };
}

/** The readiness read for the Progress volume lens. `view` mirrors the panel's
 *  List/Map switch: 'map' shows the tinted body map + legend, 'list' the
 *  per-muscle list, 'full' both. Verdict + recommendation show in every view. */
export function ReadinessLens({
  finished,
  now,
  view = 'full',
}: {
  finished: Workout[];
  now: number;
  view?: 'full' | 'map' | 'list';
}) {
  const { t } = useT();
  const map = muscleReadiness(finished, now);
  const rows = orderedRows(map);
  const v = verdict(map, t);
  const stale = staleMuscles(map)
    .slice(0, 3)
    .map((r) => t.muscleGroups[r.muscle]);
  const ready = readyMuscles(map)
    .filter((m) => map.get(m)?.state === 'ready')
    .slice(0, 3)
    .map((m) => t.muscleGroups[m]);
  const reco = ready.length ? ready : stale;
  if (rows.length === 0) return <div className="rd-lens-empty">{t.rdColdStart}</div>;
  const showMap = view !== 'list';
  const showList = view !== 'map';
  return (
    <div className="rd-lens">
      {reco.length > 0 && (
        <div className="rd-reco">
          <Icon name="check-circle" weight="fill" />
          <span>{t.rdReco(reco.join(' · '))}</span>
        </div>
      )}
      {showMap && (
        <>
          <MuscleHeatmap colors={readinessColors(map)} className="rd-map" />
          <div className="rd-legend">
            {(['recovering', 'nearly', 'ready', 'stale'] as const).map((s) => (
              <span key={s} className="rd-leg">
                <span className="sw" style={{ background: READINESS_COLOR[s] }} />
                {t.rdState[s]}
              </span>
            ))}
          </div>
        </>
      )}
      {showList && (
        <div className="rd-list">
          {rows.map((r) => (
            <ReadinessRow key={r.muscle} r={r} />
          ))}
        </div>
      )}
      {/* Verdict sits last so it reads as the lead-in to the deeper coach cards
          (fatigue, weak points) that follow directly below it. */}
      <div className="rd-verdict">
        <Icon name="heartbeat" weight="fill" />
        <div className="rd-verdict-main">
          <div className="rd-lead">{v.lead}</div>
          {v.why && <div className="rd-why">{v.why}</div>}
        </div>
      </div>
    </div>
  );
}
