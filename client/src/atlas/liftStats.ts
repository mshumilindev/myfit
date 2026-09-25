/**
 * One lift's story over ALL your sessions (not just the recent ones), for
 * loaded and bodyweight lifts alike. Pull-ups without a belt are judged by
 * reps; loaded lifts by estimated max (weight × reps).
 */
import { est1rm, setTopWeight, setTypeOf } from '../store';
import { finishedOf, type AskCtx, type Tr } from './intentKit';

export interface LiftPoint {
  ts: number;
  /** Heaviest working weight that session (0 = bodyweight). */
  kg: number;
  reps: number;
  /** Bodyweight set (no added load). */
  bw: boolean;
  /** What progress is measured in: e1RM (kg) or reps. */
  score: number;
}

/** Best set per session, oldest → newest, over your whole history. */
export function liftPoints(c: AskCtx, name: string): LiftPoint[] {
  const out: LiftPoint[] = [];
  for (const w of [...finishedOf(c)].reverse()) {
    const ex = w.exercises.find((e) => e.name === name);
    const sets = (ex?.sets ?? []).filter((s) => setTypeOf(s) !== 'warmup' && s.reps > 0);
    if (!sets.length) continue;
    const loaded = sets.filter((s) => setTopWeight(s) > 0);
    if (loaded.length) {
      const b = loaded
        .map((s) => ({
          kg: setTopWeight(s),
          reps: s.reps,
          e1: est1rm(setTopWeight(s), Math.min(12, s.reps)),
        }))
        .sort((a, b2) => b2.e1 - a.e1)[0];
      out.push({ ts: w.startedAt, kg: b.kg, reps: b.reps, bw: false, score: b.e1 || b.kg });
    } else {
      const reps = Math.max(...sets.map((s) => s.reps));
      out.push({ ts: w.startedAt, kg: 0, reps, bw: true, score: reps });
    }
  }
  return out;
}

/** True when you do this lift mostly without added load. */
export const isBodyweightLift = (pts: LiftPoint[]) =>
  pts.length > 0 && pts.filter((p) => p.bw).length >= pts.length / 2;

const WEEK = 7 * 86_400_000;

/**
 * "Pull-ups: 6 → 10 reps (+4) since 3 Mar, 12 sessions; best 11." — over the
 * last 8 weeks when there's enough there, else over everything you've logged.
 */
export function liftProgress(c: AskCtx, name: string, L: Tr): string | null {
  const all = liftPoints(c, name);
  const nm = c.fmt.exercise(name);
  if (!all.length) return null;
  if (all.length === 1)
    return L(
      `${nm}: one session so far (${fmtPoint(c, all[0], L)}). One more and I can show a trend.`,
      `${nm}: поки одне тренування (${fmtPoint(c, all[0], L)}). Ще одне — і покажу динаміку.`,
    );
  const bw = isBodyweightLift(all);
  const pts = all.filter((p) => p.bw === bw);
  const recent = pts.filter((p) => p.ts >= c.now - 8 * WEEK);
  const win = recent.length >= 2 ? recent : pts;
  const first = win[0];
  const last = win[win.length - 1];
  const best = pts.reduce((a, b) => (b.score > a.score ? b : a), pts[0]);
  const d = new Date(first.ts).toLocaleDateString(c.locale, { day: 'numeric', month: 'short' });
  const bestTxt = fmtPoint(c, best, L);
  if (bw) {
    const diff = last.reps - first.reps;
    return L(
      `${nm}: ${first.reps} → ${last.reps} reps (${sign(diff)}) since ${d}, ${win.length} sessions; best ${bestTxt}.${diff <= 0 ? ' Flat — add a rep a session, then a slow negative set.' : ''}`,
      `${nm}: ${first.reps} → ${last.reps} повт. (${sign(diff)}) з ${d}, ${win.length} трен.; найкраще ${bestTxt}.${diff <= 0 ? ' Стоїть — додавай по повтору, потім сет повільних негативів.' : ''}`,
    );
  }
  const pct = Math.round(((last.score - first.score) / Math.max(1, first.score)) * 100);
  return L(
    `${nm}: estimated max ${kg(c, first.score)} → ${kg(c, last.score)} (${sign(pct)}%) since ${d}, ${win.length} sessions; best set ${bestTxt}.${pct <= 0 ? ' Flat — same weight, one more rep each session until it moves.' : ''}`,
    `${nm}: розрахунковий максимум ${kg(c, first.score)} → ${kg(c, last.score)} (${sign(pct)}%) з ${d}, ${win.length} трен.; найкращий сет ${bestTxt}.${pct <= 0 ? ' Стоїть — та сама вага, +1 повтор щотренування, доки не зрушить.' : ''}`,
  );
}

export function fmtPoint(c: AskCtx, p: LiftPoint, L: Tr): string {
  return p.bw ? L(`${p.reps} reps`, `${p.reps} повт.`) : `${c.fmt.kg(p.kg)} × ${p.reps}`;
}
const kg = (c: AskCtx, v: number) => c.fmt.kg(Math.round(v * 2) / 2);
const sign = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '±0');
