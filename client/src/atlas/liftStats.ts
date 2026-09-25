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

/**
 * "Why is my bench stuck / why did it drop?" — the reasons your log shows,
 * not generic tips: how often you did it lately vs before, working sets for
 * its muscle, sleep, a long gap, the same weight session after session, and
 * reps fading across sets. Then what to change first.
 */
export function explainLift(c: AskCtx, name: string, L: Tr): string | null {
  const pts = liftPoints(c, name);
  if (pts.length < 3) return null;
  const nm = c.fmt.exercise(name);
  const now = c.now;
  const inWin = (from: number, to: number) => pts.filter((p) => p.ts >= from && p.ts < to);
  const recent = inWin(now - 4 * WEEK, now + 1);
  const before = inWin(now - 8 * WEEK, now - 4 * WEEK);
  const why: [string, string][] = [];
  const fix: [string, string][] = [];
  if (before.length >= 2 && recent.length < before.length)
    why.push([
      `you did it ${recent.length}× in the last 4 weeks vs ${before.length}× the 4 before`,
      `за останні 4 тижні ти робив її ${recent.length} раз(и) проти ${before.length} перед тим`,
    ]);
  const last = pts[pts.length - 1];
  const daysOff = Math.floor((now - last.ts) / 86_400_000);
  if (daysOff >= 14)
    why.push([`the last session was ${daysOff} days ago`, `останній раз — ${daysOff} дн. тому`]);
  const bw = isBodyweightLift(pts);
  const same = pts.filter((p) => p.bw === bw).slice(-4);
  if (!bw && same.length >= 3 && same.every((p) => p.kg === same[0].kg))
    why.push([
      `the same ${c.fmt.kg(same[0].kg)} for ${same.length} sessions — the load hasn't been nudged`,
      `та сама вага ${c.fmt.kg(same[0].kg)} вже ${same.length} трен. — навантаження не росте`,
    ]);
  // Sleep over the last two weeks, if you track it.
  const nights = (c.s.sleeps ?? []).filter(
    (n) => !!n.wake && n.wake >= now - 14 * 86_400_000 && !!n.bedtime,
  );
  if (nights.length >= 4) {
    const h = nights.reduce((a, n) => a + (n.wake! - n.bedtime) / 3_600_000, 0) / nights.length;
    if (h < 6.8)
      why.push([
        `you've averaged ${Math.round(h * 10) / 10} h of sleep lately`,
        `останнім часом ти спиш у середньому ${Math.round(h * 10) / 10} год`,
      ]);
  }
  // Reps fading hard across the working sets last time.
  const lastW = finishedOf(c).find((w) => w.exercises.some((e) => e.name === name));
  const reps =
    lastW?.exercises
      .find((e) => e.name === name)
      ?.sets.filter((s) => setTypeOf(s) !== 'warmup')
      .map((s) => s.reps) ?? [];
  if (reps.length >= 3 && reps[0] - reps[reps.length - 1] >= 3)
    why.push([
      `reps fell ${reps[0]} → ${reps[reps.length - 1]} across the sets last time (short rest or too heavy)`,
      `минулого разу повтори падали ${reps[0]} → ${reps[reps.length - 1]} від сету до сету (мало відпочинку або завелика вага)`,
    ]);
  if (!why.length)
    return L(
      `${nm}: nothing obvious in your log — frequency, load and sets look steady. Then it's usually recovery (sleep, food, stress) or it simply needs a small change: +1 rep a session, or a new rep range for 4 weeks.`,
      `${nm}: у журналі нічого очевидного — частота, вага й сети рівні. Тоді зазвичай справа у відновленні (сон, їжа, стрес) або потрібна дрібна зміна: +1 повтор щотренування чи новий діапазон повторів на 4 тижні.`,
    );
  if (why.some(([e]) => /in the last 4 weeks|days ago/.test(e)))
    fix.push(['get back to 2 sessions a week on it', 'повернути її 2 рази на тиждень']);
  if (why.some(([e]) => /same/.test(e)))
    fix.push([
      'add a rep each session, then 2.5 kg',
      'додавати по повтору щотренування, потім +2,5 кг',
    ]);
  if (why.some(([e]) => /sleep/.test(e)))
    fix.push(['7+ hours of sleep for two weeks', '7+ годин сну два тижні поспіль']);
  if (why.some(([e]) => /reps fell/.test(e)))
    fix.push(['rest a full 2–3 min between sets', 'відпочивати повні 2–3 хв між сетами']);
  return L(
    `${nm} — what your log shows: ${why.map((w) => w[0]).join('; ')}.${fix.length ? ` First fix: ${fix.map((f) => f[0]).join(', ')}.` : ''}`,
    `${nm} — що видно з журналу: ${why.map((w) => w[1]).join('; ')}.${fix.length ? ` Почни з цього: ${fix.map((f) => f[1]).join(', ')}.` : ''}`,
  );
}
