/**
 * "By the way…" — Atlas doesn't only answer; now and then he mentions
 * something he noticed in your log that you didn't ask about: a lift that
 * stopped moving, a muscle you've been skipping, a fresh record, a week much
 * lighter than usual. Each comes with a chip to dig in. At most one per few
 * answers, each thing at most once per conversation, the one about what
 * you're talking about first.
 */
import type { MuscleGroup } from '../data/exercises';
import { muscleSetsInWorkout } from '../store';
import { DAY, WEEK, finishedOf, loggedLifts, type AskCtx, type Tr } from './intentKit';
import { isBodyweightLift, liftPoints } from './liftStats';

export interface Insight {
  id: string;
  /** The lift / muscle it is about (to prefer the current subject). */
  about: string;
  text: string;
  chip: string;
}

const MAJOR: MuscleGroup[] = ['chest', 'lats', 'quads', 'hamstrings', 'shoulders', 'glutes'];

/** Same log, same language → same findings (they're asked for on every answer). */
let cache: { key: string; v: Insight[] } | null = null;

export function insights(c: AskCtx, L: Tr): Insight[] {
  const f = finishedOf(c);
  const key = `${c.locale}|${Math.floor(c.now / 3_600_000)}|${f.length}|${f[0]?.id ?? ''}|${f[0]?.finishedAt ?? 0}`;
  if (cache?.key === key) return cache.v;
  const v = compute(c, L);
  cache = { key, v };
  return v;
}

function compute(c: AskCtx, L: Tr): Insight[] {
  const out: Insight[] = [];
  const ws = finishedOf(c);
  if (ws.length < 4) return out;
  const nm = (x: string) => c.fmt.exercise(x);

  // A fresh record (last 3 days) on a lift you do often.
  for (const { name, count } of loggedLifts(c)) {
    if (count < 4) continue;
    const pts = liftPoints(c, name);
    const bw = isBodyweightLift(pts);
    const same = pts.filter((p) => p.bw === bw);
    const last = same[same.length - 1];
    if (!last || c.now - last.ts > 3 * DAY) continue;
    const before = same.slice(0, -1);
    if (before.length >= 3 && last.score > Math.max(...before.map((p) => p.score)))
      out.push({
        id: `pr:${name}`,
        about: name,
        text: L(
          `By the way — that ${nm(name)} last time was your best ever.`,
          `До речі — ${nm(name)} минулого разу був твоїм найкращим за весь час.`,
        ),
        chip: L('What are my best lifts?', 'Які мої рекорди?'),
      });
  }

  // A lift that stopped moving: 4+ sessions in 6 weeks, no gain.
  for (const { name } of loggedLifts(c)) {
    const pts = liftPoints(c, name);
    const bw = isBodyweightLift(pts);
    const win = pts.filter((p) => p.bw === bw && p.ts >= c.now - 6 * WEEK);
    if (win.length < 4) continue;
    const best = Math.max(...win.slice(0, -1).map((p) => p.score));
    if (win[win.length - 1].score <= win[0].score && win[win.length - 1].score <= best) {
      const weeks = Math.max(2, Math.round((win[win.length - 1].ts - win[0].ts) / WEEK));
      out.push({
        id: `stall:${name}`,
        about: name,
        text: L(
          `By the way, ${nm(name)} hasn't moved in ~${weeks} weeks.`,
          `До речі, ${nm(name)} стоїть на місці вже ~${weeks} тиж.`,
        ),
        chip: L(`How do I break a plateau?`, `Як пробити плато?`),
      });
    }
  }

  // A major muscle skipped for 10+ days while you keep training.
  const recent = ws.filter((w) => w.startedAt >= c.now - 10 * DAY);
  if (recent.length >= 2) {
    const hit = new Set<MuscleGroup>();
    for (const w of recent) for (const [m, n] of muscleSetsInWorkout(w)) if (n > 0) hit.add(m);
    const everHit = new Set<MuscleGroup>();
    for (const w of ws.slice(0, 20))
      for (const [m, n] of muscleSetsInWorkout(w)) if (n > 0) everHit.add(m);
    for (const m of MAJOR)
      if (everHit.has(m) && !hit.has(m)) {
        const mm = c.fmt.muscle(m);
        out.push({
          id: `skip:${m}`,
          about: m,
          text: L(
            `By the way, ${mm}: not a single set in 10 days.`,
            `До речі, ${mm}: жодного сету вже 10 днів.`,
          ),
          chip: L(`How often should I train ${mm}?`, `Як часто тренувати ${mm}?`),
        });
        break;
      }
  }

  // A week much lighter than your usual.
  const setsIn = (from: number, to: number) =>
    ws
      .filter((w) => w.startedAt >= from && w.startedAt < to)
      .reduce((n, w) => n + [...muscleSetsInWorkout(w).values()].reduce((a, b) => a + b, 0), 0);
  const thisWeek = setsIn(c.now - WEEK, c.now + 1);
  const usual = setsIn(c.now - 5 * WEEK, c.now - WEEK) / 4;
  if (usual >= 20 && thisWeek < usual * 0.5)
    out.push({
      id: 'light_week',
      about: '',
      text: L(
        `By the way, this week is about half your usual volume (${Math.round(thisWeek)} vs ~${Math.round(usual)} sets).`,
        `До речі, цей тиждень — десь половина твого звичного обʼєму (${Math.round(thisWeek)} проти ~${Math.round(usual)} сетів).`,
      ),
      chip: L('Sets by week', 'Сети по тижнях'),
    });
  return out;
}

/** How often, at most: one "by the way" per this many answers. */
export const TIP_EVERY = 4;
