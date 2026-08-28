/**
 * Readiness coach (feature #1). Reads each muscle on its own recovery clock
 * (recovery.ts) and turns it into a daily read: what's recovered, what's still
 * cooking, what's ready-and-behind. A compact card for Today plus a full sheet
 * with the body map, the per-muscle list and one recommendation.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { Icon, Sheet } from '../ui';
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
import type { Workout } from '../types';
import type { MuscleGroup } from '../data/exercises';

const round = (n: number): number => Math.round(n);

function verdict(
  map: Map<MuscleGroup, MuscleReadiness>,
  t: ReturnType<typeof useT>['t'],
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

function daysLabel(r: MuscleReadiness, t: ReturnType<typeof useT>['t']): string {
  if (r.daysSince === null) return t.rdBehind;
  if (r.readiness >= 1) return r.state === 'stale' ? t.rdBehind : t.rdReadyNow;
  const left = Math.max(1, Math.ceil(r.recoveryDays - r.daysSince));
  return t.rdReadyIn(left);
}

/** Ordered for the read: what's cooking first, then ready, then behind. */
function orderedRows(map: Map<MuscleGroup, MuscleReadiness>): MuscleReadiness[] {
  const rank: Record<string, number> = { recovering: 0, nearly: 1, stale: 2, ready: 3 };
  return [...map.values()]
    .filter((r) => r.daysSince !== null) // only muscles trained in the window
    .sort((a, b) => rank[a.state] - rank[b.state] || a.readiness - b.readiness);
}

/** One row of muscle chips + a trailing "Full read". No scroll: chips that
 *  don't fit are dropped from the end, so the row always ends cleanly on the
 *  "Full read" affordance rather than a half-clipped chip. */
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
      <span className="rd-chip rd-more">
        {t.rdDetails}
        <Icon name="caret-right" />
      </span>
    </div>
  );
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
      <span
        className="rd-badge"
        style={{ color: READINESS_COLOR[r.state], background: 'transparent' }}
      >
        <span className="rd-bar">
          <span
            className="rd-bar-fill"
            style={{ width: `${round(r.readiness * 100)}%`, background: READINESS_COLOR[r.state] }}
          />
        </span>
        <em className="tnum">{round(r.readiness * 100)}%</em>
      </span>
    </div>
  );
}

function ReadinessSheet({
  map,
  onClose,
}: {
  map: Map<MuscleGroup, MuscleReadiness>;
  onClose: () => void;
}) {
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
    <Sheet onClose={onClose} className="rd-sheet">
      <div className="sheet-head">
        <span className="t">{t.readinessTitle}</span>
      </div>
      <div className="rd-verdict">
        <div className="rd-lead">{v.lead}</div>
        {v.why && <div className="rd-why">{v.why}</div>}
      </div>
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
    </Sheet>
  );
}

export function ReadinessCard({ finished, now }: { finished: Workout[]; now: number }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const map = muscleReadiness(finished, now);
  const trained = [...map.values()].filter((r) => r.daysSince !== null);
  if (trained.length < 3) return null; // cold start — nothing honest to say yet

  const v = verdict(map, t);
  const cooling = recoveringMuscles(map).length;
  const readyN = readyMuscles(map).filter((m) => map.get(m)?.state === 'ready').length;
  // Strip: what's cooking first (that's the actionable bit), then a couple ready.
  // Render up to 8; the strip drops any that don't fit the row.
  const strip = orderedRows(map).slice(0, 8);

  return (
    <>
      <button className="rd-card" onClick={() => setOpen(true)}>
        <div className="rd-card-head">
          <span className="rd-kicker">{t.readinessKicker}</span>
          <span className="rd-counts tnum">
            {t.rdReadyN(readyN)} · {t.rdCoolingN(cooling)}
          </span>
        </div>
        <div className="rd-card-lead">{v.lead}</div>
        <ReadinessStrip rows={strip} />
      </button>
      {open && <ReadinessSheet map={map} onClose={() => setOpen(false)} />}
    </>
  );
}
