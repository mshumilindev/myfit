/**
 * The sealed user document users/{uid}/meta/cycle. Private: never in coachShare, never in the
 * Atlas facts, never in any note feed. Typical values only — the log is automatic, nothing is
 * entered per day.
 */
import { normalizeSettings, type CycleMode, type CycleSettings } from './cycleCore';

/** Where a soft hint may appear. Each can be turned off on its own. */
export type CycleSurface = 'today' | 'calendar' | 'session';
export const CYCLE_SURFACES: readonly CycleSurface[] = ['today', 'calendar', 'session'];

export interface CycleState {
  /** The person turned the feature on. */
  enabled: boolean;
  /** null until the first setup is saved. */
  settings: CycleSettings | null;
  /** Start dates the person entered (setup + each update), oldest first. Used for patterns only. */
  starts: number[];
  surfaces: Record<CycleSurface, boolean>;
  /** A pregnancy / menopause paused the Cycle: ask for a fresh start date when it resumes. */
  pendingDate: boolean;
  /** Last-write-wins stamp (ms); 0 = never saved. */
  updatedAt: number;
}

export const emptyCycleState = (): CycleState => ({
  enabled: false,
  settings: null,
  starts: [],
  surfaces: { today: true, calendar: true, session: true },
  pendingDate: false,
  updatedAt: 0,
});

const MODES: readonly CycleMode[] = ['regular', 'irregular', 'log'];
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function normalizeCycle(raw: unknown): CycleState {
  const out = emptyCycleState();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  if (typeof r.enabled === 'boolean') out.enabled = r.enabled;
  if (typeof r.pendingDate === 'boolean') out.pendingDate = r.pendingDate;
  if (num(r.updatedAt)) out.updatedAt = r.updatedAt;
  const s = r.settings as Partial<CycleSettings> | null | undefined;
  if (
    s &&
    typeof s === 'object' &&
    MODES.includes(s.mode as CycleMode) &&
    num(s.length) &&
    num(s.period) &&
    num(s.anchor)
  ) {
    out.settings = normalizeSettings({
      mode: s.mode as CycleMode,
      length: s.length,
      period: s.period,
      anchor: Math.round(s.anchor),
      ...(num(s.min) ? { min: s.min } : {}),
      ...(num(s.max) ? { max: s.max } : {}),
    });
  }
  if (Array.isArray(r.starts))
    out.starts = [...new Set(r.starts.filter(num).map((d) => Math.round(d)))]
      .sort((a, b) => a - b)
      .slice(-40);
  const sf = r.surfaces as Partial<Record<CycleSurface, unknown>> | undefined;
  if (sf && typeof sf === 'object')
    for (const k of CYCLE_SURFACES)
      if (typeof sf[k] === 'boolean') out.surfaces[k] = sf[k] as boolean;
  return out;
}

/** Record a newly entered start: a later date is appended, an equal or earlier one replaces the last. */
export function withStart(starts: readonly number[], day: number): number[] {
  const last = starts[starts.length - 1];
  const next = last === undefined || day > last ? [...starts, day] : [...starts.slice(0, -1), day];
  return next.slice(-40);
}
