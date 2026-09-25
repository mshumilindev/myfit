/**
 * Atlas's phrase book — English, written as English (not translated).
 * Three tempers: 1 green — your gym bro · 3 yellow — straight talk ·
 * 5 red — roasts your effort (never your body).
 */
import type { PhraseBook } from '../atlas/voice';

const pct = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(n)}%`;

export const EN: PhraseBook = {
  intro: {
    1: [
      (f) =>
        f.sessions
          ? `Yo, what's up! Atlas here. Went through your ${f.sessions} sessions — I got you on every one from now. Let's gooo!`
          : "Yo, what's up! Atlas here. Log your first session and I got you on every one after it.",
    ],
    3: [
      (f) =>
        f.sessions
          ? `Atlas. Read your ${f.sessions} sessions. I'll call it like I see it on every workout from here.`
          : 'Atlas. Nothing logged. Train first, talk later.',
    ],
    5: [
      (f) =>
        f.sessions
          ? `I read your ${f.sessions} sessions. Had a good laugh. I'll be here for every workout now — you'll regret that.`
          : 'Zero sessions. Bold strategy. Log literally anything.',
    ],
  },
  session: {
    1: [
      (f) =>
        `Let's go! ${f.sets} sets in ${f.minutes} min — that's how it's done, bro. Now eat and chill.`,
      (f) => `Boom. ${f.sets} sets, ${f.minutes} minutes. Absolute unit.`,
      (f) => `${f.sets} sets in the bag. Solid work, man!`,
    ],
    3: [
      (f) => `${f.sets} sets, ${f.minutes} min. Fine.`,
      (f) => `Done. ${f.sets} sets. Nothing to add.`,
      (f) => `${f.minutes} minutes, ${f.sets} sets. Counted. That's all.`,
    ],
    5: [
      (f) => `${f.sets} sets. You call that a workout? I've seen warm-ups with more ambition.`,
      (f) => `${f.minutes} minutes of… something. I'll log it as training. Out of pity.`,
      (f) => `${f.sets} sets. The bar probably didn't even notice it was lifted.`,
      (f) => `Logged. ${f.sets} sets. Let's hope nobody saw.`,
    ],
  },
  pr: {
    1: [
      (f, x) =>
        `LET'S GOOO! ${x.exercise(f.exercise)} ${x.kg(f.weight)} × ${f.reps} — new PR! You beast!`,
      (f, x) =>
        `Bro. ${x.exercise(f.exercise)}, ${x.kg(f.weight)} × ${f.reps}. Personal record. I'm hyped!`,
    ],
    3: [
      (f, x) =>
        `${x.exercise(f.exercise)} ${x.kg(f.weight)}. A record. Do it again and I'll believe it.`,
      (f, x) => `${x.kg(f.weight)} on ${x.exercise(f.exercise)}. Good. Don't celebrate.`,
    ],
    5: [
      (f, x) =>
        `${x.exercise(f.exercise)}, ${x.kg(f.weight)} × ${f.reps}. A "record". After ${x.kg(f.prevWeight)}, the bar was on the floor.`,
      (f, x) => `${x.exercise(f.exercise)} finally moved. I'd already started writing the eulogy.`,
      (f, x) => `${x.kg(f.weight)}. No applause — this should've happened a month ago.`,
    ],
  },
  stall: {
    1: [
      (f, x) =>
        `${x.exercise(f.exercise)}'s been sitting at ${x.kg(f.weight)} for ${f.sessions} sessions — all good, bro, it happens. One more rep next time and it'll move.`,
    ],
    3: [
      (f, x) =>
        `${x.exercise(f.exercise)}: ${x.kg(f.weight)}, ${f.sessions} times in a row. Stuck. Add a rep.`,
    ],
    5: [
      (f, x) =>
        `${x.exercise(f.exercise)} at ${x.kg(f.weight)}, session number ${f.sessions}. The bar knows your face by now. It's bored.`,
      (f, x) => `${x.kg(f.weight)}. Again. You're not training, you're serving a sentence.`,
      (f, x) =>
        `${f.sessions} sessions at the same weight. Consistency is for pensions, not for ${x.exercise(f.exercise)}.`,
    ],
  },
  restShort: {
    1: [
      (f, x) =>
        `Bro, you only rested ${x.mmss(f.restSec)} on ${x.exercise(f.exercise)}. Take the full ${x.mmss(f.targetSec)} — your last sets will thank you.`,
    ],
    3: [
      (f, x) =>
        `You rested ${x.mmss(f.restSec)}. It should've been ${x.mmss(f.targetSec)}. That's the whole story.`,
    ],
    5: [
      (f, x) =>
        `${x.mmss(f.restSec)} rest. Late for something? Because your progress sure isn't in a hurry.`,
      (f, x) =>
        `${x.mmss(f.targetSec)} means ${x.mmss(f.targetSec)}, not ${x.mmss(f.restSec)}. Can you count? Then what's your excuse on the bar?`,
    ],
  },
  setDrop: {
    1: [
      (f) =>
        `${f.prevReps} → ${f.reps} reps — no stress, man. Sit a little longer before the next one.`,
    ],
    3: [(f) => `${f.reps}? Last set was ${f.prevReps}. Rest properly.`],
    5: [
      (f) => `${f.reps}. After ${f.prevReps}. You deflated faster than a party balloon.`,
      (f) => `${f.reps} reps. The bench under you is working harder.`,
    ],
  },
  skipped: {
    1: [
      (f) =>
        `${f.dayName ? `Yo, it's ${f.dayName} day` : "Yo, it's a training day"} — even a quick one counts. You in?`,
    ],
    3: [(f) => `${f.dayName ?? 'Training'}. Today. You know where the gym is.`],
    5: [
      (f) =>
        `${f.dayName ?? 'Training'} day, and you're nowhere. The couch must be thrilled. At least someone is.`,
      () => `Still not at the gym? It's fine, the dumbbells are used to being ghosted.`,
    ],
  },
  imbalance: {
    1: [
      (f, x) =>
        `Bro, ${x.muscle(f.high)} got ${f.highSets} sets and ${x.muscle(f.low)} only ${f.lowSets}. Let's show ${x.muscle(f.low)} some love next time!`,
    ],
    3: [
      (f, x) =>
        `${x.muscle(f.high)}: ${f.highSets} sets. ${x.muscle(f.low)}: ${f.lowSets}. Fix it.`,
    ],
    5: [
      (f, x) =>
        `${x.muscle(f.high)} ${f.highSets}, ${x.muscle(f.low)} ${f.lowSets}. Only training the fun stuff? Very grown-up.`,
    ],
  },
  week: {
    1: [
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions} of ${f.planned} — week absolutely crushed! Legend!`
          : `${f.sessions} of ${f.planned} this week. No stress, every one counted — we go again next week!`,
    ],
    3: [
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions} of ${f.planned}. On plan.`
          : `${f.sessions} of ${f.planned}. Off plan.`,
    ],
    5: [
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions} of ${f.planned}. Huh. Who are you and what did you do with my client?`
          : `${f.sessions} of ${f.planned}. I expected little, and you still managed to underdeliver.`,
    ],
  },
  comeback: {
    1: [
      (f) => `Ayy, welcome back, bro! ${f.daysOff} days is nothing. Easy one today, we'll ramp up.`,
    ],
    3: [(f) => `${f.daysOff} days off. You're back — start light.`],
    5: [
      (f) =>
        `${f.daysOff} days. I assumed you'd moved to the couch permanently. Start light — your pride will survive, it's used to it.`,
    ],
  },
  shortSleep: {
    1: [(f) => `Only ${f.hours} h of sleep — take it easy today, bro, and hit the sack early.`],
    3: [(f) => `${f.hours} h of sleep. Lighter today.`],
    5: [(f) => `${f.hours} h of sleep. Lighter today.`],
  },
  streak: {
    1: [(f) => `${f.days} days in a row! You're on fire, bro!`],
    3: [(f) => `${f.days} days in a row. Keep it.`],
    5: [(f) => `${f.days} days in a row. Don't get used to praise — there won't be any.`],
  },
  bodyweight: {
    1: [(f, x) => `Bodyweight ${x.kg(f.kg)}, ${pct(f.deltaPct)} over ${f.days} days.`],
    3: [(f, x) => `Bodyweight ${x.kg(f.kg)}, ${pct(f.deltaPct)} over ${f.days} days.`],
    5: [(f, x) => `Bodyweight ${x.kg(f.kg)}, ${pct(f.deltaPct)} over ${f.days} days.`],
  },
  mom: {
    session: [(f) => `${f.sets} sets. Your mom does more on a Sunday between loads of laundry.`],
    stall: [
      (f, x) => `${x.exercise(f.exercise)}, ${x.kg(f.weight)}, again. Your mom warms up with that.`,
    ],
    restShort: [
      (f, x) => `${x.mmss(f.restSec)} rest. Your mom takes longer between two voice notes.`,
    ],
    skipped: [() => `Your mom already trained today. Just saying.`],
    setDrop: [(f) => `${f.reps}? Your mom did ${f.prevReps} with the empty bar and didn't whine.`],
    week: [
      (f) => `${f.sessions} sessions. Your mom gets more done in a week. And still feeds you.`,
    ],
  },
};
