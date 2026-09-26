/**
 * Mid-session questions — "what weight next set?", "how many sets left?",
 * "what's next?", "how much have I done?" — answered from the workout that is
 * open right now, not from general advice.
 */
import { setTypeOf } from '../store';
import type { Exercise, Workout } from '../types';
import type { AskCtx, Tr } from './intentKit';
import { normalize } from './nlu';

const NEXT_SET =
  /(наступн\S* (сет|підхід|підхода|раз)|next set|яку вагу (зараз|ставити|на наступн\S*)|what weight (now|next|for the next)|скільки (ставити|вішати|вешать) (зараз|на наступн\S*)|вага на наступн\S*|сколько (ставить|вешать))/u;
const LEFT =
  /(скільки (ще|залишилось|лишилось|осталось) (підход\S*|сет\S*|вправ\S*)|how many (more )?(sets|exercises) (left|to go)|sets left|сколько (еще|ещё|осталось) (подход\S*|сет\S*))/u;
const WHATS_NEXT =
  /((^|\s)що далі|що наступне|яка наступна вправа|наступна вправа|what.?s next|next exercise|что дальше|следующее упражнение)/u;
const DONE =
  /(скільки я (вже )?(зробив|зробила|наробив|підняв|підняла)|(за |у |в )?це(й|го)? (тренуванн\S*|сесі\S*)|цього тренування|how much (have i|did i) (done|lift\S*) (today|so far)|this session|so far today|сколько я (уже )?сделал)/u;

function current(w: Workout): Exercise | undefined {
  // The lift with the most recent set, else the last one added.
  const withSets = w.exercises.filter((e) => e.sets.length);
  const byTime = withSets
    .map((e) => ({
      e,
      at: Math.max(...e.sets.map((s) => (s as { loggedAt?: number }).loggedAt ?? 0)),
    }))
    .sort((a, b) => b.at - a.at);
  return byTime[0]?.e ?? w.exercises[w.exercises.length - 1];
}

const working = (e: Exercise) => e.sets.filter((s) => setTypeOf(s) !== 'warmup');

export function liveAnswer(
  c: AskCtx,
  question: string,
  L: Tr,
): { id: string; text: string } | null {
  const w = c.s.workouts.find((x) => x.finishedAt === null && x.exercises.length);
  if (!w) return null;
  const ph = ` ${normalize(question)} `;
  const cur = current(w);
  const name = (e: Exercise) => c.fmt.exercise(e.name);

  if (NEXT_SET.test(ph) && cur) {
    const done = working(cur);
    const last = done[done.length - 1];
    if (!last || !last.weight)
      return {
        id: 'live_next_set',
        text: L(
          `${name(cur)}: no working set logged yet — start with the weight you did last time, or ask “what weight next time on ${name(cur)}”.`,
          `${name(cur)}: робочих підходів ще нема — почни з ваги минулого разу або спитай «яку вагу ставити на ${name(cur)}».`,
        ),
      };
    const target = cur.plannedReps ?? null;
    const kg = last.weight;
    // Hit the top of the target (or 12+ with none) → a small jump; fell 2+ short → hold.
    const up = target ? last.reps >= target + 1 : last.reps >= 12;
    const short = target ? last.reps <= target - 2 : false;
    const step = kg >= 60 ? 2.5 : 1;
    const next = up ? kg + step : kg;
    return {
      id: 'live_next_set',
      text: up
        ? L(
            `${name(cur)}: last set ${c.fmt.kg(kg)} × ${last.reps} — that went well. Next set ${c.fmt.kg(next)}.`,
            `${name(cur)}: останній підхід ${c.fmt.kg(kg)} × ${last.reps} — пішло добре. Наступний — ${c.fmt.kg(next)}.`,
          )
        : short
          ? L(
              `${name(cur)}: ${last.reps} reps at ${c.fmt.kg(kg)} is short of your ${target}. Keep ${c.fmt.kg(kg)} and rest a bit longer — or drop to ${c.fmt.kg(kg - step)} if the next set stalls too.`,
              `${name(cur)}: ${last.reps} повт. на ${c.fmt.kg(kg)} — менше за план (${target}). Лиши ${c.fmt.kg(kg)} і відпочинь трохи довше — або ${c.fmt.kg(kg - step)}, якщо й наступний не піде.`,
            )
          : L(
              `${name(cur)}: stay at ${c.fmt.kg(kg)} — last set ${last.reps} reps${target ? ` of ${target}` : ''}.`,
              `${name(cur)}: лишай ${c.fmt.kg(kg)} — останній підхід ${last.reps} повт.${target ? ` з ${target}` : ''}.`,
            ),
    };
  }
  if (LEFT.test(ph)) {
    const rest = w.exercises.filter((e) => !working(e).length);
    const curLeft = cur?.plannedSets ? Math.max(0, cur.plannedSets - working(cur).length) : null;
    const parts: string[] = [];
    if (cur && curLeft !== null)
      parts.push(
        L(
          `${name(cur)}: ${curLeft} set${curLeft === 1 ? '' : 's'} left`,
          `${name(cur)}: лишилось ${curLeft} підх.`,
        ),
      );
    parts.push(
      rest.length
        ? L(
            `${rest.length} more exercise${rest.length === 1 ? '' : 's'}: ${rest.map(name).join(', ')}`,
            `ще вправ: ${rest.length} — ${rest.map(name).join(', ')}`,
          )
        : L('no more exercises after this one', 'після цієї вправ більше нема'),
    );
    return { id: 'live_left', text: `${parts.join('; ')}.`.replace(/^./, (x) => x.toUpperCase()) };
  }
  if (WHATS_NEXT.test(ph)) {
    const next = w.exercises.find((e) => e !== cur && !working(e).length);
    return {
      id: 'live_next',
      text: next
        ? L(
            `Next: ${name(next)}${next.plannedSets ? ` — ${next.plannedSets} × ${next.plannedReps ?? '8–12'}` : ''}.`,
            `Далі: ${name(next)}${next.plannedSets ? ` — ${next.plannedSets} × ${next.plannedReps ?? '8–12'}` : ''}.`,
          )
        : L(
            'That was the last one in this session — cool down and finish when you’re ready.',
            'Це була остання вправа — заминка й завершуй, коли будеш готовий.',
          ),
    };
  }
  if (DONE.test(ph)) {
    const sets = w.exercises.flatMap(working);
    const vol = Math.round(sets.reduce((a, s) => a + (s.weight ?? 0) * s.reps, 0));
    const min = Math.max(1, Math.round((c.now - w.startedAt) / 60000));
    return {
      id: 'live_done',
      text: L(
        `This session so far: ${sets.length} working sets, ${vol ? c.fmt.kg(vol) + ' moved, ' : ''}${min} min.`,
        `Це тренування поки: ${sets.length} робочих підходів, ${vol ? 'піднято ' + c.fmt.kg(vol) + ', ' : ''}${min} хв.`,
      ),
    };
  }
  return null;
}
