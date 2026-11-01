/**
 * SPO-35 · P0 — the conversational exam: multi-turn dialogues about the user's OWN log (richCtx), not topic routing.
 * Each case is a short chat; `expect` must match the LAST answer, `forbid` must not match it.
 * `gap: true` marks a known weakness (documented, not yet fixed): gaps are counted separately and their number may
 * only shrink (convEval.test.ts). Fixing one = drop its `gap` flag; a new failure on a non-gap case is a regression.
 * The synthetic log (testCtx): Pullups 10 kg × 8 × 3 sets, Squat 110 kg × 6, Bench 85 kg × 8 (last session 2 days ago).
 */
export interface ConvCase {
  loc: 'en' | 'uk' | 'pl' | 'lt' | 'et';
  turns: string[];
  expect: RegExp;
  forbid?: RegExp;
  gap?: boolean;
}

const c = (
  loc: ConvCase['loc'],
  turns: string[],
  expect: RegExp,
  o: Partial<ConvCase> = {},
): ConvCase => ({ loc, turns, expect, ...o });

export const CONV_CASES: ConvCase[] = [
  // weight vs reps vs sets (the SPO-35 trigger: "з якою вагою я останнім часом робив pullups")
  c('en', ['what weight did I use for pullups last time'], /10 kg/, { forbid: /reps \(/ }),
  c('en', ['how many reps of pullups did I do last time'], /8, 8, 8/),
  c('en', ['how many sets of pullups did I do last time'], /\b3\b/),
  c('en', ['how heavy was my last pullup set'], /10 kg/),
  c('uk', ['з якою вагою я останнім часом робив підтягування'], /10 kg/),
  c('uk', ['з яким обтяженням я робив підтягування'], /10 kg/),
  c('uk', ['вага на підтягуваннях'], /10 kg/),
  c('uk', ['скільки повторів підтягувань я робив востаннє'], /8, 8, 8/),
  c('pl', ['z jakim ciężarem robiłem ostatnio podciąganie'], /10 kg/),
  c('en', ['what weight did I squat last time'], /110 kg/),
  c('en', ['what did I bench last time'], /85|bench/i),
  // best / records
  c('en', ['what is my heaviest squat'], /heaviest|110/i),
  c('en', ['heaviest deadlift ever?'], /deadlift/i),
  // clarification and follow-ups
  c('en', ['what weight last time', 'pullups'], /10 kg/),
  c('en', ['what weight did I use for pullups last time', 'and squat?'], /Squat.*110 kg|110 kg/s),
  c('en', ['what weight did I use for pullups last time', 'how about reps'], /8, 8, 8/),
  c('uk', ['з якою вагою я робив підтягування', 'а присід?'], /110/),
  // must NOT be hijacked: advice, planning, trends, capability
  c('en', ['what weight should I use for pullups next time'], /.*/, {
    forbid: /2 days ago|Which lift/,
  }),
  c('en', ['how many reps can I do with 70 kg bench'], /.*/, { forbid: /Which lift|8, 8, 8/ }),
  c('en', ['how do I increase my pull-up reps'], /.*/, { forbid: /8, 8, 8/ }),
  c('en', ['i do bjj 3 times a week, how many lifting days'], /.*/, { forbid: /Which lift/ }),
  // P3 — the chat itself: memory of what was asked and said, going further back
  c(
    'en',
    ['what weight did I use for pullups last time', 'what did I just ask you?'],
    /You asked.*pullups/i,
  ),
  c('en', ['what weight did I use for pullups last time', 'repeat that'], /10 kg on all 3 sets/),
  c('en', ['what weight did I use for pullups last time', 'say that again'], /10 kg on all 3 sets/),
  c(
    'en',
    ['how many reps of pullups last time', 'and the time before that?'],
    /8, 8, 8 reps|reps/,
    {
      forbid: /recover|48–72/,
    },
  ),
  c('uk', ['з якою вагою я робив підтягування', 'що я щойно питав?'], /Ти питав.*підтягування/),
  c('uk', ['з якою вагою я робив підтягування', 'повтори'], /10 kg на всіх 3/),
  c('uk', ['з якою вагою я робив підтягування', 'а раніше?'], /8 kg/),
  c(
    'en',
    ['what weight did I use for pullups last time', 'what was my first question'],
    /first question.*pullups/i,
  ),
  c('en', ['repeat that'], /Nothing to repeat/),
  // P4 — a pain check-in is left when the person asks about something else, and stays for its own answers
  c(
    'en',
    ['my knee hurts when I squat', 'what weight did I use for pullups last time'],
    /10 kg on all 3 sets/,
    {
      forbid: /When does it hurt/,
    },
  ),
  c('uk', ['болить коліно при присіді', 'з якою вагою я робив підтягування'], /10 kg на всіх 3/, {
    forbid: /Коли болить/,
  }),
  c('en', ['my shoulder hurts', 'thanks'], /Happy to help|No stress/i, {
    forbid: /How bad|When does/,
  }),
  c('en', ['my shoulder hurts', 'it is sharp'], /hurt|feel|How bad|After which/i),
  c('en', ['my elbow hurts', 'it hurts on bench'], /When does it hurt|feel|How bad/i),
  // P5 — swearing is not an insult: a question with a curse in it is answered; an insult aimed at the app still is one
  c('en', ['what the fuck is my bench max'], /1RM|estimated/i, { forbid: /No hard feelings/ }),
  c('en', ['fucking hell what did I squat last time'], /110 kg/, { forbid: /No hard feelings/ }),
  c('en', ['holy shit that is heavy, am I recovered'], /Recovery|recover/i, {
    forbid: /No hard feelings/,
  }),
  c('uk', ['бляха болить коліно'], /біль|Коли болить|Після/i),
  c('uk', ['пиздець я втомився, чи відновився я'], /Батарейка|відновл|Recovery/i, {
    forbid: /Ой, промазав/,
  }),
  c('en', ['this app is shit'], /No hard feelings/),
  // P6 — the right topic: units and sums are computed, "what is Spotter" is the app, not spotting someone
  c('en', ['what is 80 kg in lbs'], /176\.4 lb/, { forbid: /Log bodyweight/ }),
  c('uk', ['скільки буде 80 кг у фунтах'], /176,4 lb/),
  c('pl', ['ile to 80 kg w funtach'], /176\.4 lb/),
  c('uk', ['скільки 25 помножити на 4'], /^100\./),
  c('uk', ['розрахуй 12*15'], /^180\./),
  c('en', ['what is Spotter'], /Spotter in a nutshell/),
  c('uk', ['що таке Spotter'], /Spotter коротко/),
  // known weaknesses found by the SPO-35 spike (fix → drop `gap`)
  c('en', ['log 3 sets of pullups'], /Log|Запис|set/i, { forbid: /3–4 days a week/, gap: true }),
  c('en', ['how many sets of pullups did I do last week'], /\b[1-9]\d* sets?\b/, { gap: true }),
  c('pl', ['rekord w wyciskaniu'], /Bench/i, { gap: true }),
  c('en', ['how much did I weigh a month ago'], /kg/),
  c('pl', ['ile powtórzeń podciągania zrobiłem ostatnio'], /8, 8, 8/, { gap: true }),
  c('lt', ['kokiu svoriu paskutinį kartą traukiausi prie skersinio'], /10 kg/, { gap: true }),
  c('et', ['mis raskusega ma viimati lätti tegin'], /110 kg/, { gap: true }),
];
