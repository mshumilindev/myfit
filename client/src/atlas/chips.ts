/**
 * "What next?" chips that stay on the subject. After an answer about your
 * bench, the next steps are about your bench (technique, next weight, what
 * to swap it for, how it went by month); after chest — about chest; after a
 * computed question — the same numbers sliced another way. Topics close to
 * the one just answered (by example phrasings) fill the rest; the generic
 * "what should I train today" is the last resort, not the default.
 */
import type { MuscleGroup } from '../data/exercises';
import type { AskCtx, Parsed, Tr } from './intentKit';
import { ASKS } from './asks';
import { retrieve } from './retrieve';

type Tpl = [id: string, en: string, uk: string];

/** Follow-ups about the lift in question ("{x}" = its name). */
const LIFT: Tpl[] = [
  ['progress_lift', 'How is my {x} going?', 'Як прогресує {x}?'],
  ['next_weight', '{x}: what weight next time?', '{x}: яку вагу наступного разу?'],
  ['technique_lift', '{x}: technique tips?', '{x}: техніка?'],
  ['alternatives', 'What can replace {x}?', 'Чим замінити {x}?'],
  ['exercise_muscles', 'What muscles does {x} work?', 'Які мʼязи працюють у {x}?'],
  ['warmup_lift', '{x}: warm-up sets?', '{x}: розминочні підходи?'],
  ['e1rm', 'My 1RM on {x}?', 'Мій 1ПМ у {x}?'],
  ['lift_last', 'When did I last do {x}?', 'Коли я востаннє робив {x}?'],
  ['log_query', '{x}: average reps per set', '{x}: середні повтори за сет'],
];

/** Follow-ups about the muscle in question. */
const MUSCLE: Tpl[] = [
  ['volume_muscle', 'How many sets on {x} this week?', 'Скільки сетів на {x} цього тижня?'],
  ['muscle_frequency', 'How often should I train {x}?', 'Як часто тренувати {x}?'],
  ['muscle_last', 'When did I last train {x}?', 'Коли я востаннє тренував {x}?'],
  ['log_query', 'Sets on {x} by week', 'Сети на {x} по тижнях'],
];

/** What each topic naturally leads to, when it names no lift or muscle. */
const NEXT: Record<string, string[]> = {
  rest: ['rest_actual', 'supersets', 'session_length'],
  today: ['warmup', 'session_length', 'tomorrow'],
  tomorrow: ['today', 'recovery', 'rest_day'],
  recovery: ['sleep', 'deload', 'rest_day'],
  sleep: ['recovery', 'caffeine', 'rest_day'],
  deload: ['plateau', 'recovery', 'periodization'],
  plateau: ['deload', 'add_weight', 'failure'],
  protein: ['carbs', 'meals_count', 'supplements'],
  creatine: ['supplements', 'protein', 'caffeine'],
  fat_loss: ['cut_deficit', 'cardio', 'protein'],
  week: ['weak', 'month', 'best_weekday'],
  month: ['week', 'range_summary', 'weak'],
  best: ['heaviest', 'then_vs_now', 'progress_lift'],
  weak: ['volume_muscle', 'muscle_frequency', 'week'],
  warmup: ['warmup_sets', 'cooldown', 'today'],
  cardio: ['cardio_done', 'cardio_gains', 'steps'],
};

const fill = (t: string, x: string) => t.replace('{x}', x);

/**
 * Up to `n` follow-ups for an answer on topic `id` to question `q`.
 * `own` = the topic's own hand-written suggestions (kept, but after the
 * subject-specific ones).
 */
export function topicalChips(
  id: string,
  q: string,
  p: Parsed,
  c: AskCtx,
  L: Tr,
  own: string[] = [],
  n = 3,
): string[] {
  const out: string[] = [];
  const add = (s: string) => {
    if (s && !out.includes(s) && out.length < n) out.push(s);
  };
  // 1) The same lift / muscle, a different angle.
  if (p.exercise) {
    const x = c.fmt.exercise(p.exercise);
    for (const [tid, en, uk] of rotate(LIFT, q)) if (tid !== id) add(fill(L(en, uk), x));
    out.splice(2);
  } else if (p.muscle) {
    const x = c.fmt.muscle(p.muscle as MuscleGroup);
    for (const [tid, en, uk] of rotate(MUSCLE, q)) if (tid !== id) add(fill(L(en, uk), x));
    out.splice(2);
  }
  // 2) What this topic leads to.
  for (const nid of NEXT[id] ?? []) if (ASKS[nid]) add(L(...ASKS[nid]));
  // 3) Its own suggestions.
  for (const s of own) add(s);
  // 4) Neighbouring topics by meaning.
  for (const h of retrieve(q, 6))
    if (h.id !== id && h.score >= 0.25 && ASKS[h.id]) add(L(...ASKS[h.id]));
  return out;
}

/** Start the list at a question-dependent place, so chips vary. */
function rotate<T>(xs: T[], seed: string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const k = Math.abs(h) % xs.length;
  return [...xs.slice(k), ...xs.slice(0, k)];
}
