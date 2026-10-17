/**
 * Atlas answers about a lift's next weight, in words: what to load next and why.
 * After a training break (SPO-149) the progression engine returns a 'return' target
 * (lighter, or no jump); every call here gives `nextTarget` the clock and the body mass
 * so it can tell, and the sore-body cap never multiplies with the break cut.
 */
import { latestWeight } from '../store';
import { gapWeeks } from '../detraining';
import { nextTarget, topHistory, type ProgOpts, type Target } from '../progression';
import * as N from './num';
import { SORE_CAP } from './memoryPlan';
import { finishedOf, type AskCtx, type Tr } from './intentKit';

/** `now` + body mass for `nextTarget`, so a break shows up as a 'return' target. */
function breakOpts(c: AskCtx): Pick<ProgOpts, 'now' | 'bodyKg'> {
  return { now: c.now, bodyKg: latestWeight(c.s.bodyMetrics)?.weight ?? null };
}

/** The next-weight answer for a 'return' target. */
function returnAnswer(c: AskCtx, tg: Target, name: string, last: string, L: Tr): string {
  const next = tg.weight != null ? N.setText(c, tg.weight, tg.reps) : `${tg.reps}`;
  if (tg.returnKind === 'regain')
    return L(
      `${name}: last ${last}. Still building back to your pre-break weight — next: ${next}.`,
      `${name}: минулого разу ${last}. Ще повертаємо вагу до рівня до перерви — далі: ${next}.`,
    );
  const w = gapWeeks(tg.gapDays ?? 0);
  if (tg.returnKind === 'ease')
    return L(
      `${name}: ${w} weeks since last time (${last}). Same weight, no jump this time: ${next}.`,
      `${name}: ${w} тиж. від останнього разу (${last}). Та сама вага, без стрибка цього разу: ${next}.`,
    );
  return L(
    `${name}: ${w} weeks since last time (${last}). Start lighter: ${next} — you will climb back to your old weight quickly.`,
    `${name}: ${w} тиж. від останнього разу (${last}). Почни легше: ${next} — стару вагу швидко повернеш.`,
  );
}

/** The "why this weight" sentence for a 'return' target. */
function returnReason(tg: Target, name: string, L: Tr): string {
  if (tg.returnKind === 'regain')
    return L(
      `After the break ${name} starts lighter and climbs back one step a session until you reach your old weight.`,
      `Після перерви ${name} стартує легше й повертається на крок за тренування, доки не дійдеш до старої ваги.`,
    );
  const w = gapWeeks(tg.gapDays ?? 0);
  return tg.returnKind === 'ease'
    ? L(
        `${w} weeks since your last ${name}: same weight, no jump, so the body gets used to it again.`,
        `${w} тиж. від останнього ${name}: та сама вага без стрибка, щоб тіло звикло знову.`,
      )
    : L(
        `${w} weeks since your last ${name}: strength dips a bit, so you start lighter and climb back fast.`,
        `${w} тиж. від останнього ${name}: сила трохи падає, тож стартуєш легше й швидко повертаєшся.`,
      );
}

/** The next target of a lift as of `c.now` (a 'return' target after a break). */
export function liftTargetOf(c: AskCtx, exercise: string): Target {
  return nextTarget(topHistory(finishedOf(c), exercise, c.now), breakOpts(c));
}

/** The weight to take when something is sore: capped, and never capped twice after a break. */
export function soreWeight(tg: Target): number {
  const back = tg.state === 'return';
  const basis = (back ? tg.prevWeight : tg.weight) ?? tg.weight ?? 0;
  const capped = Math.max(2.5, Math.round((basis * SORE_CAP) / 2.5) * 2.5);
  return back && tg.weight != null ? Math.min(tg.weight, capped) : capped;
}

/** "Next weight" for a loaded lift (not a bodyweight one). */
export function nextWeightText(c: AskCtx, ex: string, name: string, L: Tr): string {
  const tg = liftTargetOf(c, ex);
  if (tg.state === 'first' || tg.weight == null)
    return L(
      `No ${name} logged yet. Start light, ${tg.repLow}–${tg.repHigh} clean reps, and I’ll take it from there.`,
      `${name} ще не записано. Почни легко, ${tg.repLow}–${tg.repHigh} чистих повторів — далі поведу я.`,
    );
  const last = tg.prevWeight != null ? `${N.setText(c, tg.prevWeight, tg.prevReps)}` : '—';
  if (tg.state === 'return') return returnAnswer(c, tg, name, last, L);
  if (tg.deltaKg < 0)
    return L(
      `${name}: last ${last}. Stuck there — back off to ${N.setText(c, tg.weight, tg.reps)} and build up again.`,
      `${name}: минулого разу ${last}. Застряг — скинь до ${N.setText(c, tg.weight, tg.reps)} і набирай знову.`,
    );
  return tg.deltaKg > 0
    ? L(
        `${name}: last ${last}. Next: ${N.setText(c, tg.weight, tg.reps)}.`,
        `${name}: минулого разу ${last}. Далі: ${N.setText(c, tg.weight, tg.reps)}.`,
      )
    : L(
        `${name}: last ${last}. Stay at ${c.fmt.kg(tg.weight)} and get ${tg.reps} reps before adding weight.`,
        `${name}: минулого разу ${last}. Лишайся на ${c.fmt.kg(tg.weight)} і добий до ${tg.reps} повторів — тоді додамо.`,
      );
}

/** One sentence on why today's target is what it is. */
export function whyWeightBit(c: AskCtx, exercise: string, L: Tr): string {
  const tg = liftTargetOf(c, exercise);
  const name = c.fmt.exercise(exercise);
  if (tg.state === 'first')
    return L('No history yet, so I start light.', 'Історії ще нема, тож починаю легко.');
  if (tg.state === 'return') return returnReason(tg, name, L);
  if (tg.deltaKg < 0)
    return L(
      `${name} stalled at the same top weight 3 sessions running — a small back-off lets you build past it.`,
      `${name} стоїть на тій самій вазі 3 тренування поспіль — невеликий відкат дає пройти далі.`,
    );
  if (tg.deltaKg > 0)
    return L(
      `You hit the top of the rep range last time (${tg.prevReps} reps), so the weight goes up.`,
      `Минулого разу ти дійшов до верху діапазону (${tg.prevReps} повт.), тож вага росте.`,
    );
  return L(
    `Last time ${tg.prevReps} reps — not the top of the range yet, so same weight, more reps.`,
    `Минулого разу ${tg.prevReps} повт. — ще не верх діапазону, тож та сама вага, більше повторів.`,
  );
}
