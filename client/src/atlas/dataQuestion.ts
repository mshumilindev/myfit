/**
 * Questions about YOUR OWN log of one lift — "with what weight did I last do pull-ups", "how many reps was my
 * heaviest squat", "how many sets of rows last week" (SPO-35). The message is read as
 *
 *   METRIC (weight | reps | sets | volume)  ×  LIFT  ×  WHICH (last session | best | in a period)
 *
 * and answered from the log directly, so the metric asked for is the metric answered, and the lift named is the
 * lift reported. The keyword topics ("more pull-ups", "knee cave", …) never see these messages.
 *
 * Only three languages' words are read here (en, uk/ru, pl); the rest of the languages fall through to the
 * existing routing unchanged.
 */
import { exerciseVolumeKg, setTopWeight, setTypeOf } from '../store';
import type { Exercise, Workout } from '../types';
import { DAY, finishedOf, type AskCtx, type Parsed, type Range, type Tr } from './intentKit';
import * as N from './num';

export type DataMetric = 'weight' | 'reps' | 'sets' | 'volume';
export type DataWhich = 'last' | 'best' | 'period';

/** What the chat remembers of a data question, for follow-ups ("and squat?", "the time before that?"). */
export interface DataMemo {
  metric: DataMetric | null;
  which: DataWhich;
  /** How many sessions back from the latest ("the time before that" → 1). */
  skip?: number;
}
export interface DataQuery extends DataMemo {
  exercise: string | null;
}

const WEIGHT_RE =
  /\b(weight|weights|heavy|heaviest|kg|kilos?|load|loaded)\b|ваг\p{L}*|обтяжен|важк|важч|скільки кг|кілограм|ciężar|ciezar|ile kg|kilogram/iu;
const REPS_RE =
  /\b(reps?|repetitions?|how many (times|pull ?ups?|push ?ups?|chin ?ups?|reps)|times)\b|повтор|скільки раз|разів|раз(ів)? я|powtórz|powtorz|ile razy/iu;
// "how heavy was my last set" asks for the weight: only a COUNT of sets is the sets metric.
const SETS_RE =
  /how many sets|number of sets|sets of\b|sets (did|have)|скільки (підходів|сетів)|підходів|ile (serii|podej)/iu;
const VOLUME_RE = /\b(volume|tonnage)\b|об['’ʼ]?єм|обсяг|objęto|objeto/iu;
const LAST_RE =
  /\b(last|latest|previous|most recent|recently|lately|yesterday)\b|востаннє|останн|минул\p{L}*\s*раз|минулого|ostatni|ostatnio|poprzedni/iu;
const NOT_A_LOOKUP_RE =
  /\b(change[ds]?|improv\w*|progress\w*|trend\w*|since|lately|rest|between)\b|змін\p{L}*|прогрес|останнім часом|як там|більше разів|робити|відпочин|times? (a|per) (week|month)|lifting days|days|in total|overall|all[- ]time|altogether|загалом|разом|усього|łącznie|ostatnio|zmieni\p{L}*|w tym tygodniu|kiek/iu;
const BEST_RE =
  /\b(best|heaviest|max|maximum|pr|personal record|record|top)\b|найкращ|найважч|рекорд|максим|najlepsz|najcięższ|rekord/iu;
const SELF_RE =
  /\b(i|my|me|did i|have i|was my)\b|(?<!\p{L})я(?!\p{L})|мій|моя|моє|мої|мен[іе]|мене|(?<!\p{L})ja(?!\p{L})|mój|moja|moje/iu;
const PAST_RE =
  /\b(did|used|lifted|took|put|do|done|was|were)\b|брав|робив|ставив|жав|підтяг\p{L}*|рвав|robiłem|robilem/iu;

/** Which lifts-only question this is, or null when it is not about the log of one lift. */
export function readDataQuestion(question: string, p: Parsed, c: AskCtx): DataQuery | null {
  const q = question.toLowerCase();
  const metric: DataMetric | null = VOLUME_RE.test(q)
    ? 'volume'
    : SETS_RE.test(q)
      ? 'sets'
      : REPS_RE.test(q)
        ? 'reps'
        : WEIGHT_RE.test(q)
          ? 'weight'
          : null;
  const last = LAST_RE.test(q.replace(/\blast\s+(week|month|year|\d+)\b/giu, ' '));
  const best = BEST_RE.test(q);
  const period = !!p.range && !p.range.ago;
  // A metric AND a way of pointing into the log are both needed: "how much weight should I use" or "how many reps
  // are best" are advice questions, not log questions.
  if (!metric && !last) return null;
  const short = q.trim().split(/\s+/).length <= 4 && !!p.exercise;
  // a bare "вага на підтягуваннях" / "last bench weight": the log is the only sensible reading
  if (!last && !best && !period && !(SELF_RE.test(q) && PAST_RE.test(q)) && !short) return null;
  if (metric !== 'volume' && !SELF_RE.test(q) && !PAST_RE.test(q) && !last && !short) return null;
  const which: DataWhich = period ? 'period' : best && !last ? 'best' : 'last';
  // "should I", "how long", "next time" — planning and duration, handled by their own topics.
  if (
    /\b(should|next time|how long|how often|plan|recommend|how (do|can|to)|can i|could i|will i|why|scared|afraid|or)\b|варто|наступн|скільки трив|jak długo/iu.test(
      q,
    )
  )
    return null;
  // "how many reps with 70 kg" is a capability/estimate question (reps_at_weight), not a lookup of what was logged.
  if (/\b\d+(\.\d+)?\s*(kg|lbs?|кг)\b|\bwith\s+\d/iu.test(q) && !last) return null;
  // Trends, comparisons and how-to/advice are other topics (progress, log_query, coaching), not a lookup.
  if (NOT_A_LOOKUP_RE.test(q)) return null;
  // "and for heavy squats?" — a follow-up: only the conversation (readDataFollowUp) knows what is being continued.
  if (FOLLOW_RE.test(q)) return null;
  void c;
  return { metric, which, exercise: p.exercise };
}

const working = (e: Exercise) => e.sets.filter((s) => setTypeOf(s) !== 'warmup' && s.reps > 0);

/** The most recent finished session that has the lift, with its working sets. */
export function lastSessionOf(
  c: AskCtx,
  name: string,
  skip = 0,
): { w: Workout; e: Exercise } | null {
  let left = skip;
  for (const w of finishedOf(c)) {
    const e = w.exercises.find((x) => x.name === name);
    if (e && working(e).length && left-- <= 0) return { w, e };
  }
  return null;
}

function when(c: AskCtx, ts: number): string {
  const days = Math.max(0, Math.round((c.now - ts) / DAY));
  const date = new Date(ts).toLocaleDateString(c.locale);
  return `${N.daysAgo(c.locale, days)} (${date})`;
}

/** "10 kg × 8, 10 kg × 8" grouped: "3 × 10 kg × 8". */
function setLine(c: AskCtx, sets: Exercise['sets'], bw: boolean): string {
  const groups: { text: string; n: number }[] = [];
  for (const s of sets) {
    const kg = setTopWeight(s);
    const text = N.setText(c, kg > 0 ? kg : null, s.reps);
    const g = groups[groups.length - 1];
    if (g && g.text === text) g.n += 1;
    else groups.push({ text, n: 1 });
  }
  void bw;
  return groups.map((g) => (g.n > 1 ? `${g.n} × ${g.text}` : g.text)).join(', ');
}

export function answerDataQuestion(
  q: DataQuery,
  c: AskCtx,
  range: Range | null | undefined,
  L: Tr,
): string | null {
  const name = q.exercise;
  if (!name) return null;
  const nm = c.fmt.exercise(name);
  if (q.which === 'last') {
    const hit = lastSessionOf(c, name, q.skip);
    if (!hit) return L(`${nm}: not in your log yet.`, `${nm}: у журналі ще нема.`);
    const sets = working(hit.e);
    const when_ = when(c, hit.w.startedAt);
    const kgs = sets.map((s) => setTopWeight(s)).filter((k) => k > 0);
    if (q.metric === 'weight') {
      if (!kgs.length)
        return L(
          `${nm}, ${when_}: no added weight (bodyweight), best set ${sets.reduce((m, s) => Math.max(m, s.reps), 0)} reps.`,
          `${nm}, ${when_}: без додаткової ваги (власна вага), найкращий сет ${sets.reduce((m, s) => Math.max(m, s.reps), 0)} повт.`,
        );
      const top = Math.max(...kgs);
      const lo = Math.min(...kgs);
      const added = kgs.length === sets.length && sets.every((s) => setTopWeight(s) > 0);
      void added;
      return top === lo
        ? L(
            `${nm}, ${when_}: ${c.fmt.kg(top)} on all ${sets.length} sets.`,
            `${nm}, ${when_}: ${c.fmt.kg(top)} на всіх ${sets.length} підходах.`,
          )
        : L(
            `${nm}, ${when_}: ${c.fmt.kg(lo)}–${c.fmt.kg(top)}, top ${c.fmt.kg(top)}.`,
            `${nm}, ${when_}: ${c.fmt.kg(lo)}–${c.fmt.kg(top)}, максимум ${c.fmt.kg(top)}.`,
          );
    }
    if (q.metric === 'reps') {
      const reps = sets.map((s) => s.reps);
      const total = reps.reduce((a, b) => a + b, 0);
      return L(
        `${nm}, ${when_}: ${reps.join(', ')} reps (${total} in total).`,
        `${nm}, ${when_}: ${reps.join(', ')} повторів (усього ${total}).`,
      );
    }
    if (q.metric === 'sets')
      return L(
        `${nm}, ${when_}: ${N.sets('en', sets.length)}.`,
        `${nm}, ${when_}: ${N.sets('uk', sets.length)}.`,
      );
    return L(
      `${nm}, ${when_}: ${setLine(c, sets, !kgs.length)}.`,
      `${nm}, ${when_}: ${setLine(c, sets, !kgs.length)}.`,
    );
  }
  // best: the heaviest set ever (by weight, then reps); bodyweight lifts by reps
  const all: { ts: number; kg: number; reps: number }[] = [];
  for (const w of finishedOf(c)) {
    const e = w.exercises.find((x) => x.name === name);
    if (e)
      for (const s of working(e)) all.push({ ts: w.startedAt, kg: setTopWeight(s), reps: s.reps });
  }
  if (q.which === 'best') {
    if (!all.length) return L(`${nm}: not in your log yet.`, `${nm}: у журналі ще нема.`);
    if (q.metric === 'reps') {
      const b = all.reduce((m, s) => (s.reps > m.reps ? s : m));
      return L(
        `${nm}: most reps in a set — ${b.reps}${b.kg > 0 ? ` at ${c.fmt.kg(b.kg)}` : ''}, ${when(c, b.ts)}.`,
        `${nm}: найбільше повторів за сет — ${b.reps}${b.kg > 0 ? ` з ${c.fmt.kg(b.kg)}` : ''}, ${when(c, b.ts)}.`,
      );
    }
    const b = all.reduce((m, s) => (s.kg > m.kg || (s.kg === m.kg && s.reps > m.reps) ? s : m));
    return b.kg > 0
      ? L(
          `${nm}: heaviest set — ${N.setText(c, b.kg, b.reps)}, ${when(c, b.ts)}.`,
          `${nm}: найважчий сет — ${N.setText(c, b.kg, b.reps)}, ${when(c, b.ts)}.`,
        )
      : L(
          `${nm}: bodyweight only so far, best set ${b.reps} reps, ${when(c, b.ts)}.`,
          `${nm}: поки лише з власною вагою, найкращий сет ${b.reps} повт., ${when(c, b.ts)}.`,
        );
  }
  // a period: volume or sets in the range
  const from = range?.from ?? 0;
  const to = range?.to ?? c.now;
  const within = finishedOf(c).filter((w) => w.startedAt >= from && w.startedAt <= to);
  let nSets = 0;
  let vol = 0;
  for (const w of within) {
    const e = w.exercises.find((x) => x.name === name);
    if (e) {
      nSets += working(e).length;
      vol += exerciseVolumeKg(e);
    }
  }
  if (!nSets)
    return L(`${nm}: nothing logged in that period.`, `${nm}: за цей період нічого нема.`);
  return q.metric === 'volume'
    ? L(
        `${nm}: ${c.fmt.kg(Math.round(vol))} of volume over ${N.sets('en', nSets)} in that period.`,
        `${nm}: обʼєм ${c.fmt.kg(Math.round(vol))} за ${N.sets('uk', nSets)} за цей період.`,
      )
    : L(
        `${nm}: ${N.sets('en', nSets)} in that period.`,
        `${nm}: ${N.sets('uk', nSets)} за цей період.`,
      );
}

const BEFORE_RE =
  /^\s*(and |so )?(the )?(time|session|one) before( that| last)?\W*$|^\s*(а |і )?(раніше|перед тим|до того|попередн\p{L}*)\W*$|^\s*(a )?(wcześniej|przedtem|poprzednio)\W*$/iu;
const FOLLOW_RE = /^\s*(and|so|what about|how about|а|і|и|та|a|a co z|co z)\b/iu;

/**
 * "and squat?", "а станова?", "what weight last time", "how about reps" — a short message that changes one slot of the
 * previous log question and keeps the others.
 */
export function readDataFollowUp(
  question: string,
  p: Parsed,
  prev: DataMemo,
  exercise: string | null | undefined,
): DataQuery | null {
  const q = question.toLowerCase();
  // "and the time before that?", "а раніше?" — the same lift and metric, one session further back.
  if (exercise && prev.which === 'last' && BEFORE_RE.test(q))
    return { metric: prev.metric, which: 'last', exercise, skip: (prev.skip ?? 0) + 1 };
  if (q.trim().split(/\s+/).length > 6 || NOT_A_LOOKUP_RE.test(q)) return null;
  const metric: DataMetric | null = VOLUME_RE.test(q)
    ? 'volume'
    : SETS_RE.test(q)
      ? 'sets'
      : REPS_RE.test(q)
        ? 'reps'
        : WEIGHT_RE.test(q)
          ? 'weight'
          : null;
  const last = LAST_RE.test(q.replace(/\blast\s+(week|month|year|\d+)\b/giu, ' '));
  if (p.exercise && !metric && !last && FOLLOW_RE.test(q))
    return { metric: prev.metric, which: prev.which, exercise: p.exercise };
  if (
    !p.exercise &&
    exercise &&
    metric &&
    (last || FOLLOW_RE.test(q) || q.trim().split(/\s+/).length <= 4)
  )
    return { metric, which: last ? 'last' : prev.which, exercise };
  return null;
}
