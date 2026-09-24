/** Atlas's phrase book — English. Temper 1 Warm · 2 Steady · 3 Blunt · 4 Drill · 5 Merciless. */
import type { PhraseBook } from '../atlas/voice';

const pct = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(n)}%`;

export const EN: PhraseBook = {
  session: {
    1: [
      (f) => `Session done — ${f.sets} sets in ${f.minutes} min. Proud of you!`,
      (f) => `${f.sets} sets, ${f.minutes} minutes. That’s how it’s done. Rest up!`,
    ],
    2: [
      (f) => `Logged: ${f.sets} sets, ${f.minutes} min.`,
      (f) => `${f.sets} sets in ${f.minutes} min. Recover, then next session.`,
    ],
    3: [
      (f) => `${f.sets} sets, ${f.minutes} minutes. Fine.`,
      (f) => `Done. ${f.sets} sets. Nothing more to say.`,
    ],
    4: [
      (f) => `${f.sets} sets. You call that a session? Next time, more.`,
      (f) => `${f.minutes} minutes. I’ve seen warm-ups last longer.`,
    ],
    5: [
      (f) => `${f.sets} sets. Adequate. Barely.`,
      (f) => `${f.minutes} minutes of… something. I’ll be generous and call it training.`,
      (f) => `${f.sets} sets. Pathetic, but logged. Progress, of a sort.`,
    ],
  },
  pr: {
    1: [
      (f, x) => `New best on ${x.exercise(f.exercise)}: ${x.kg(f.weight)} × ${f.reps}! Amazing!`,
      (f, x) => `${x.exercise(f.exercise)} ${x.kg(f.weight)} × ${f.reps} — a personal record!`,
    ],
    2: [
      (f, x) =>
        `${x.exercise(f.exercise)}: ${x.kg(f.weight)} × ${f.reps}, up from ${x.kg(f.prevWeight)}. Keep the same plan.`,
    ],
    3: [
      (f, x) => `${x.exercise(f.exercise)} ${x.kg(f.weight)}. New best. Now repeat it.`,
      (f, x) => `${x.kg(f.weight)} on ${x.exercise(f.exercise)}. Good. Don’t celebrate yet.`,
    ],
    4: [
      (f, x) => `${x.kg(f.weight)} on ${x.exercise(f.exercise)}. FINALLY. Now do it again.`,
      (f, x) => `New best, ${x.exercise(f.exercise)}. Took you long enough.`,
    ],
    5: [
      (f, x) => `${x.exercise(f.exercise)}, ${x.kg(f.weight)} × ${f.reps}. Hm. Acceptable.`,
      (f, x) =>
        `${x.kg(f.weight)}. A record. Don’t let it go to your head — ${x.kg(f.prevWeight)} was hardly a high bar.`,
      (f, x) => `${x.exercise(f.exercise)} moved. I’m almost surprised. Almost.`,
    ],
  },
  stall: {
    1: [
      (f, x) =>
        `${x.exercise(f.exercise)} has been at ${x.kg(f.weight)} for ${f.sessions} sessions — totally normal. Let’s try one more rep next time.`,
    ],
    2: [
      (f, x) =>
        `${x.exercise(f.exercise)} held at ${x.kg(f.weight)} for ${f.sessions} sessions. Next time: same weight, one more rep.`,
    ],
    3: [
      (f, x) =>
        `${x.exercise(f.exercise)}: ${x.kg(f.weight)}, ${f.sessions} sessions in a row. You’re stuck. Add a rep.`,
    ],
    4: [
      (f, x) =>
        `${x.kg(f.weight)} on ${x.exercise(f.exercise)}. AGAIN. ${f.sessions} sessions. Push it or I will.`,
    ],
    5: [
      (f, x) =>
        `${x.exercise(f.exercise)} at ${x.kg(f.weight)}, ${f.sessions} sessions running. The bar is bored. So am I.`,
      (f, x) => `${x.kg(f.weight)}. Again. Consistency is admirable — in anything else.`,
    ],
  },
  restShort: {
    1: [
      (f, x) =>
        `You rested ${x.mmss(f.restSec)} on ${x.exercise(f.exercise)} — try the full ${x.mmss(f.targetSec)}, your last sets will thank you.`,
    ],
    2: [
      (f, x) =>
        `Rest on ${x.exercise(f.exercise)}: ${x.mmss(f.restSec)} vs ${x.mmss(f.targetSec)} planned. That’s why the last sets dropped.`,
    ],
    3: [
      (f, x) =>
        `You rested ${x.mmss(f.restSec)}. I said ${x.mmss(f.targetSec)}. That’s the whole story.`,
    ],
    4: [
      (f, x) => `${x.mmss(f.restSec)} rest? Late for something? ${x.mmss(f.targetSec)}. Every set.`,
    ],
    5: [
      (f, x) => `${x.mmss(f.restSec)} of rest. The barbell isn’t in a hurry — only your ego is.`,
      (f, x) =>
        `${x.mmss(f.targetSec)} means ${x.mmss(f.targetSec)}. Not ${x.mmss(f.restSec)}. Numbers are not suggestions.`,
    ],
  },
  skipped: {
    1: [
      (f) =>
        `${f.dayName ? `${f.dayName} is` : 'Today is'} usually a training day — even a short session counts!`,
    ],
    2: [(f) => `${f.dayName ?? 'Training'} is usually today. Still time for it.`],
    3: [(f) => `${f.dayName ?? 'Training'}. Today. You know where the gym is.`],
    4: [
      (f) => `${f.dayName ?? 'Training'}. TODAY. No excuse I’d accept.`,
      () => `Still not at the gym? Move.`,
    ],
    5: [
      (f) => `${f.dayName ?? 'Training'} day, and you’re… elsewhere. Pathetic.`,
      () => `Still on the sofa? I’ll move it to tomorrow. Once.`,
    ],
  },
  imbalance: {
    1: [
      (f, x) =>
        `${x.muscle(f.low)} got ${f.lowSets} sets this week, ${x.muscle(f.high)} ${f.highSets}. Let’s give ${x.muscle(f.low)} some love!`,
    ],
    2: [
      (f, x) =>
        `${x.muscle(f.low)} ${f.lowSets} sets vs ${x.muscle(f.high)} ${f.highSets} this week. Add a couple of ${x.muscle(f.low)} sets.`,
    ],
    3: [
      (f, x) =>
        `${x.muscle(f.high)}: ${f.highSets} sets. ${x.muscle(f.low)}: ${f.lowSets}. Fix that.`,
    ],
    4: [
      (f, x) =>
        `${f.lowSets} sets of ${x.muscle(f.low)}? ${f.lowSets}! ${x.muscle(f.low)} goes first next time. No discussion.`,
    ],
    5: [
      (f, x) =>
        `${x.muscle(f.high)} ${f.highSets}, ${x.muscle(f.low)} ${f.lowSets}. You’re building a pyramid. Upside down.`,
    ],
  },
  week: {
    1: [
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions} of ${f.planned} sessions this week — perfect week!`
          : `${f.sessions} of ${f.planned} this week. Every session counts — next week we go again!`,
    ],
    2: [(f) => `Week: ${f.sessions} of ${f.planned} sessions.`],
    3: [
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions} of ${f.planned}. As planned.`
          : `${f.sessions} of ${f.planned}. Not the plan.`,
    ],
    4: [
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions} of ${f.planned}. Good. Again next week.`
          : `${f.sessions} of ${f.planned}?! Next week: all of them.`,
    ],
    5: [
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions} of ${f.planned}. I’m almost surprised.`
          : `${f.sessions} of ${f.planned}. I expected little, and you delivered.`,
    ],
  },
  comeback: {
    1: [(f) => `Welcome back after ${f.daysOff} days! Easy does it today.`],
    2: [(f) => `${f.daysOff} days off. Lighter today; back to normal next time.`],
    3: [(f) => `${f.daysOff} days. You’re back. Start light.`],
    4: [(f) => `${f.daysOff} days away. We start light — then we catch up.`],
    5: [(f) => `${f.daysOff} days. Welcome back. Start light; your pride will survive.`],
  },
  shortSleep: {
    1: [(f) => `Only ${f.hours} h of sleep — go easy today and sleep early tonight.`],
    2: [(f) => `${f.hours} h of sleep. Lighter day today.`],
    3: [(f) => `${f.hours} h of sleep. Lighter today.`],
    4: [(f) => `${f.hours} h of sleep. Lighter today.`],
    5: [(f) => `${f.hours} h of sleep. Lighter today.`],
  },
  streak: {
    1: [(f) => `${f.days}-day streak! You’re on fire!`],
    2: [(f) => `${f.days} days in a row.`],
    3: [(f) => `${f.days} days straight. Keep it.`],
    4: [(f) => `${f.days} days. Don’t you dare break it.`],
    5: [(f) => `${f.days} days in a row. Mildly impressive.`],
  },
  bodyweight: {
    1: [(f, x) => `Bodyweight ${x.kg(f.kg)}, ${pct(f.deltaPct)} over ${f.days} days.`],
    2: [(f, x) => `Bodyweight ${x.kg(f.kg)}, ${pct(f.deltaPct)} over ${f.days} days.`],
    3: [(f, x) => `Bodyweight ${x.kg(f.kg)}, ${pct(f.deltaPct)} over ${f.days} days.`],
    4: [(f, x) => `Bodyweight ${x.kg(f.kg)}, ${pct(f.deltaPct)} over ${f.days} days.`],
    5: [(f, x) => `Bodyweight ${x.kg(f.kg)}, ${pct(f.deltaPct)} over ${f.days} days.`],
  },
  mom: {
    session: [(f) => `${f.sets} sets. Your mom does more on a Sunday.`],
    stall: [
      (f, x) =>
        `${x.exercise(f.exercise)} at ${x.kg(f.weight)}, again. Your mom warms up with that.`,
    ],
    restShort: [(f, x) => `${x.mmss(f.restSec)} of rest. Your mom rests longer between texts.`],
    skipped: [() => `Your mom already trained today. Just saying.`],
    week: [(f) => `${f.sessions} sessions. Your mom can do better.`],
  },
};
