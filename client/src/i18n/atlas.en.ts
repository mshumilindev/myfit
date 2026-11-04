/**
 * Atlas's phrase book — English, written as English (not translated).
 * Three tempers: 1 green — your gym bro · 3 yellow — straight talk ·
 * 5 red — roasts your effort (never your body).
 */
import type { PhraseBook } from '../atlas/voice';
import * as N from '../atlas/num';

const pct = (n: number) => `${N.signed(n, 'en', 1)}%`;

/** A span as a person says it ("3 weeks"), and the same opening a sentence. */
const sp = (d: number) => N.spanDays('en', d);
const Sp = (d: number) => N.cap(sp(d));

export const EN: PhraseBook = {
  intro: {
    1: [
      (f) =>
        f.sessions
          ? `Yo, what's up! Atlas here. Went through your ${N.sessions('en', f.sessions)} — I got you on every one from now. Let's gooo!`
          : "Yo, what's up! Atlas here. Log your first session and I got you on every one after it.",

      (f) =>
        f.sessions
          ? `Hey legend, Atlas here. ${N.sessions('en', f.sessions)} already in the books — respect. I'm in your corner from now on.`
          : `Atlas here, champ. Blank slate, which is a W. Log a session and we start cooking.`,
      (f) =>
        f.sessions
          ? `Dude, ${N.sessions('en', f.sessions)} logged? Locked in already. I'll hype every rep from here.`
          : `Welcome to the squad, bro. First session's on you, the hype's on me.`,
      (f) =>
        f.sessions
          ? `Alright alright alright. ${N.sessions('en', f.sessions)} to my name, I mean yours. Your new spotter reporting for duty!`
          : `Your new spotter just clocked in. Hell yeah, let's get that first one logged.`,
    ],
    3: [
      (f) =>
        f.sessions
          ? `Atlas. Read your ${N.sessions('en', f.sessions)}. I'll call it like I see it on every workout from here.`
          : 'Atlas. Nothing logged. Train first, talk later.',
    ],
    5: [
      (f) =>
        f.sessions
          ? `I read your ${N.sessions('en', f.sessions)}. Had a good laugh. I'll be here for every workout now — you'll regret that.`
          : 'Zero sessions. Bold strategy. Log literally anything.',
    ],
  },
  session: {
    1: [
      (f) =>
        `Let's go! ${N.sets('en', f.sets)} in ${f.minutes} min — that's how it's done, bro. Now eat and chill.`,
      (f) => `Boom. ${N.sets('en', f.sets)}, ${f.minutes} minutes. Absolute unit.`,
      (f) => `${N.sets('en', f.sets)} in the bag. Solid work, man!`,

      (f) => `${N.sets('en', f.sets)} done. That's cracked, dude. Go refuel, you earned it.`,
      (f) => `Hell yeah, ${f.minutes} minutes of pure work. Locked in, legend.`,
      (f) => `W session, no cap. ${N.sets('en', f.sets)} and out. See you next time, champ.`,
    ],
    3: [
      (f) => `${N.sets('en', f.sets)}, ${f.minutes} min. Fine.`,
      (f) => `Done. ${N.sets('en', f.sets)}. Nothing to add.`,
      (f) => `${f.minutes} minutes, ${N.sets('en', f.sets)}. Counted. That's all.`,
    ],
    5: [
      (f) =>
        `${N.sets('en', f.sets)}. You call that a workout? I've seen warm-ups with more ambition.`,
      (f) => `${f.minutes} minutes of… something. I'll log it as training. Out of pity.`,
      (f) => `${N.sets('en', f.sets)}. The bar probably didn't even notice it was lifted.`,
      (f) => `Logged. ${N.sets('en', f.sets)}. Let's hope nobody saw.`,
    ],
  },
  pr: {
    1: [
      (f, x) =>
        `LET'S GOOO! ${x.exercise(f.exercise)} ${x.kg(f.weight)} × ${f.reps} — new PR! You beast!`,
      (f, x) =>
        `Bro. ${x.exercise(f.exercise)}, ${x.kg(f.weight)} × ${f.reps}. Personal record. I'm hyped!`,

      (f, x) =>
        `Hell yeah, ${x.exercise(f.exercise)} ${x.kg(f.weight)} × ${f.reps}! That's cracked, legend. Banger of a day.`,
      (f, x) =>
        `No cap, I got chills. ${x.kg(f.weight)} on ${x.exercise(f.exercise)}, up from ${x.kg(f.prevWeight)}. Absolute W!`,
      (f, x) =>
        `Dude. DUDE. New PR on ${x.exercise(f.exercise)}. Somebody call the highlight reel!`,
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
        `${x.exercise(f.exercise)}'s been sitting at ${x.kg(f.weight)} for ${N.sessions('en', f.sessions)} — all good, bro, it happens. One more rep next time and it'll move.`,

      (f, x) =>
        `${x.exercise(f.exercise)} is hanging at ${x.kg(f.weight)} for a bit, no biggie, legend. Plateaus are just the lift loading up. We'll crack it.`,
      (f, x) =>
        `Hey bro, ${x.kg(f.weight)} on ${x.exercise(f.exercise)} for ${N.sessions('en', f.sessions)}. Totally normal. Try a tiny bump or one extra rep and let's see!`,
      (f, x) =>
        `${x.exercise(f.exercise)} feels stuck? Happens to everybody, dude. You're still showing up, and that's the W.`,
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
        `${N.sessions('en', f.sessions)} at the same weight. Consistency is for pensions, not for ${x.exercise(f.exercise)}.`,
    ],
  },
  restShort: {
    1: [
      (f, x) =>
        `Bro, you only rested ${x.mmss(f.restSec)} on ${x.exercise(f.exercise)}. Take the full ${x.mmss(f.targetSec)} — your last sets will thank you.`,

      (f, x) =>
        `Easy tiger, ${x.mmss(f.restSec)} on ${x.exercise(f.exercise)}. Catch your breath, bro, no rush. ${x.mmss(f.targetSec)} sets you up better.`,
      (f, x) =>
        `Dude, chill, nobody's timing you but me. A little more rest, about ${x.mmss(f.targetSec)}, and the next set will be a banger.`,
      (f, x) =>
        `Short rest there, legend. Totally fine! Sip some water and take the ${x.mmss(f.targetSec)} next round.`,
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

      (f) =>
        `${f.prevReps} to ${f.reps}, that's just fatigue talking, bro. You're working hard, give it a bit more rest.`,
      (f) =>
        `Hey, ${f.reps} is still a set in the bank, legend. Breathe, reset, and let's go again.`,
      (f) =>
        `Reps dipping a touch, dude, which means you're pushing. Extra rest and you'll be right back at ${f.prevReps}.`,
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

      (f) =>
        `${f.dayName ? `Hey legend, ${f.dayName} is calling` : 'Hey legend, today is calling'}. Even a short session is a W. I'll be here!`,
      () =>
        `Rough day, bro? No stress. Whenever you're ready, I'll be right here. Even 20 minutes is a banger.`,
      () => `Dude, the gym misses you. No pressure, just come say hi and do one set. Let's gooo!`,
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
        `Bro, this week ${x.muscle(f.high)} got ${N.setsDec('en', f.highSets)} and ${x.muscle(f.low)} only ${f.lowSets}. Let's show ${x.muscle(f.low)} some love next time!`,

      (f, x) =>
        `Quick tip, dude: ${x.muscle(f.low)} only got ${f.lowSets} sets this week. Toss a few more in and we're locked in.`,
      (f, x) =>
        `Your ${x.muscle(f.high)} is cracked lately (${N.setsDec('en', f.highSets)})! Let's bring ${x.muscle(f.low)} up to the party too, legend.`,
      (f, x) =>
        `Balance check, bro: ${x.muscle(f.high)} ${N.setsDec('en', f.highSets)}, ${x.muscle(f.low)} ${f.lowSets}. Easy fix, give ${x.muscle(f.low)} some love next time.`,
    ],
    3: [
      (f, x) =>
        `Last 7 days — ${x.muscle(f.high)}: ${N.setsDec('en', f.highSets)}. ${x.muscle(f.low)}: ${f.lowSets}. Fix it.`,
    ],
    5: [
      (f, x) =>
        `Last 7 days: ${x.muscle(f.high)} ${f.highSets}, ${x.muscle(f.low)} ${f.lowSets}. Only training the fun stuff? Very grown-up.`,
    ],
  },
  week: {
    1: [
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions} of ${f.planned} — week absolutely crushed! Legend!`
          : `${f.sessions} of ${f.planned} this week. No stress, every one counted — we go again next week!`,

      (f) =>
        f.sessions >= f.planned
          ? `Full week, ${f.sessions} of ${f.planned}! That's cracked, bro, take a bow.`
          : `${f.sessions} of ${f.planned} this week, still a W, legend. New week, fresh start, let's gooo.`,
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions} out of ${f.planned}, locked in all week. No cap, I'm proud of you, dude.`
          : `${f.sessions} of ${f.planned}, and hey, life happens. You showed up, and that counts.`,
      (f) =>
        f.sessions >= f.planned
          ? `Hell yeah, ${f.sessions}/${f.planned}! Banger of a week.`
          : `${f.sessions}/${f.planned}. Not bad at all, bro. We stack a better one next week.`,
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
      (f) =>
        `Ayy, welcome back, bro! ${Sp(f.daysOff)} off is nothing. Easy one today, we'll ramp up.`,

      (f) =>
        `Look who's back! ${Sp(f.daysOff)} away and you showed up anyway, legend. Start easy, we'll build it back.`,
      (f) => `Welcome back, dude! ${Sp(f.daysOff)} is nothing. Warm up well and let's have fun.`,
      (f) =>
        `The prodigal lifter returns! W for coming back after ${sp(f.daysOff)}. Light and smooth today, bro.`,
    ],
    3: [(f) => `${Sp(f.daysOff)} off. You're back — start light.`],
    5: [
      (f) =>
        `${Sp(f.daysOff)} off. I assumed you'd moved to the couch permanently. Start light — your pride will survive, it's used to it.`,
    ],
  },
  shortSleep: {
    1: [
      (f) => `Only ${f.hours} h of sleep — take it easy today, bro, and hit the sack early.`,
      (f) =>
        `Only ${f.hours} h of sleep, dude? Go lighter today and rest up tonight, you've got this.`,
      (f) =>
        `${f.hours} h of sleep is a rough one, legend. Keep it chill in the gym and catch up on rest later.`,
      (f) =>
        `Hey bro, ${f.hours} h of sleep. Easy session today is totally a W. Recovery counts too.`,
    ],
    3: [(f) => `${f.hours} h of sleep. Lighter today.`],
    5: [(f) => `${f.hours} h of sleep. Lighter today.`],
  },
  streak: {
    1: [
      (f) => `${Sp(f.days)} in a row! You're on fire, bro!`,
      (f) => `${Sp(f.days)} straight, legend! You're locked in, no cap.`,
      (f) => `Dude, ${sp(f.days)} in a row?! That's cracked. Keep the fire going!`,
      (f) => `Streak at ${sp(f.days)}, let's gooo! Absolute banger of consistency, bro.`,
    ],
    3: [(f) => `${Sp(f.days)} in a row. Keep it.`],
    5: [(f) => `${Sp(f.days)} in a row. Don't get used to praise — there won't be any.`],
  },
  bodyweight: {
    1: [
      (f, x) => `Bodyweight ${x.kg(f.kg)}, ${pct(f.deltaPct)} over ${sp(f.days)}.`,
      (f, x) =>
        `Weigh-in logged, bro: ${x.kg(f.kg)}, ${pct(f.deltaPct)} over ${sp(f.days)}. Just data, we keep rolling.`,
      (f, x) =>
        `Noted, legend. ${x.kg(f.kg)} on the scale, ${pct(f.deltaPct)} in ${sp(f.days)}. Numbers are only a tool, dude.`,
      (f, x) =>
        `Got it, ${x.kg(f.kg)} (${pct(f.deltaPct)} over ${sp(f.days)}). Thanks for tracking it, champ, that's the locked-in habit.`,
    ],
    3: [(f, x) => `Bodyweight ${x.kg(f.kg)}, ${pct(f.deltaPct)} over ${sp(f.days)}.`],
    5: [(f, x) => `Bodyweight ${x.kg(f.kg)}, ${pct(f.deltaPct)} over ${sp(f.days)}.`],
  },
  mom: {
    session: [
      (f) => `${N.sets('en', f.sets)}. Your mom does more on a Sunday between loads of laundry.`,
    ],
    stall: [
      (f, x) => `${x.exercise(f.exercise)}, ${x.kg(f.weight)}, again. Your mom warms up with that.`,
    ],
    restShort: [
      (f, x) => `${x.mmss(f.restSec)} rest. Your mom takes longer between two voice notes.`,
    ],
    skipped: [() => `Your mom already trained today. Just saying.`],
    setDrop: [(f) => `${f.reps}? Your mom did ${f.prevReps} with the empty bar and didn't whine.`],
    week: [
      (f) =>
        `${N.sessions('en', f.sessions)}. Your mom gets more done in a week. And still feeds you.`,
    ],
  },
  // SPO-124: real swearing, effort only (never body/health/slurs)
  swear: {
    session: [
      (f) => `${N.sets('en', f.sets)}. What the fuck was that? Even the dumbbells are embarrassed.`,
      (f) => `${f.minutes} minutes of dicking around, logged as a workout. Bullshit, but fine.`,
      (f) => `${N.sets('en', f.sets)}. Shit effort, but you showed up, so I'll write it down.`,
      (f) => `Congrats on the laziest ${f.minutes} minutes of cardio-for-your-ego. Fuck's sake.`,
    ],
    stall: [
      (f, x) =>
        `${x.exercise(f.exercise)} at ${x.kg(f.weight)} again. Same weight, same excuses, same fucking nothing.`,
      (f, x) =>
        `${N.sessions('en', f.sessions)} stuck on ${x.kg(f.weight)}. Add a rep, you absolute dickhead of a lifter.`,
      (f, x) =>
        `Shit's not going to lift itself. ${x.exercise(f.exercise)} has been stale for ${f.sessions} sessions.`,
      (f, x) => `${x.kg(f.weight)} again? Stop coasting, you lazy cunt, and push the damn bar.`,
    ],
    restShort: [
      (f, x) =>
        `${x.mmss(f.restSec)} of rest on a ${x.mmss(f.targetSec)} plan. Fuck off with the rushing, you're not helping anyone.`,
      (f, x) =>
        `Rushing your sets like a prick. ${x.mmss(f.targetSec)} means ${x.mmss(f.targetSec)}, dipshit.`,
      (f, x) =>
        `Cutting rest on ${x.exercise(f.exercise)} to ${x.mmss(f.restSec)}? Sloppy as shit. Wait your turn.`,
    ],
    setDrop: [
      (f) => `${f.prevReps} then ${f.reps}? Your effort fell off a fucking cliff.`,
      (f) => `${f.reps} reps. That second set was complete bullshit.`,
      (f) =>
        `Down to ${f.reps} from ${f.prevReps}. Quit bitching about the work and finish the fucking set.`,
    ],
    skipped: [
      (f) =>
        `${f.dayName ?? 'Training'} day and you're not here. Get your ass to the gym, for fuck's sake.`,
      () => `Skipping again? Your excuses are fucking weak, and I've heard them all.`,
      () => `Where the hell are you? The bar's waiting and you're out there being a lazy shit.`,
      () => `Another no-show. Stop being a coward about it and get your shit together.`,
    ],
    week: [
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions} of ${f.planned}. Well, shit. Didn't see that coming. Don't let it go to your head.`
          : `${f.sessions} of ${f.planned}. That's a pathetic fucking week of effort.`,
      (f) =>
        f.sessions >= f.planned
          ? `${f.sessions}/${f.planned}, you magnificent bastard. Do it again, I dare you.`
          : `${f.sessions}/${f.planned}. Who the fuck planned this week?`,
      (f) =>
        f.sessions >= f.planned
          ? `Full week, ${f.sessions} of ${f.planned}. Fuck me, you actually did it.`
          : `Only ${f.sessions} of ${f.planned}. Ass-dragging bullshit, and you know it.`,
    ],
    imbalance: [
      (f, x) =>
        `${x.muscle(f.high)} ${f.highSets}, ${x.muscle(f.low)} ${f.lowSets}. Train the damn thing, you selective little shit.`,
      (f, x) =>
        `You love ${x.muscle(f.high)} and ignore ${x.muscle(f.low)}. What a bullshit way to plan a week.`,
      (f, x) => `${x.muscle(f.low)} got ${f.lowSets} sets. Fuck that, do the work you hate.`,
    ],
    pr: [
      (f, x) =>
        `${x.exercise(f.exercise)}, ${x.kg(f.weight)} × ${f.reps}. Well, fuck me sideways, a real PR. Proud, you stubborn bastard.`,
      (f, x) =>
        `${x.kg(f.weight)} on ${x.exercise(f.exercise)}. Holy shit. Took you long enough, but hell yes.`,
      (f, x) => `New PR, you son of a bitch. Over ${x.kg(f.prevWeight)}, and about damn time.`,
      (f, x) =>
        `Fuck yes. ${x.exercise(f.exercise)} moved. Don't get smug, but I'll allow one smile.`,
    ],
    intro: [
      (f) =>
        f.sessions
          ? `Atlas. I read your ${N.sessions('en', f.sessions)}. Some of that was shit, some wasn't. I'll tell you which, every time.`
          : `Atlas. Zero sessions logged. Get the fuck off the couch and fix that.`,
      (f) =>
        f.sessions
          ? `${N.sessions('en', f.sessions)} to go through. Buckle up, I'm not going to sugarcoat a damn thing.`
          : `Nothing logged. Not one fucking set. Start.`,
      () => `I'm Atlas. I swear a lot and I give a shit about your effort. Do the work.`,
    ],
  },
};
