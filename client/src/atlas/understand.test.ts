import { describe, expect, it } from 'vitest';
import { bareAsk, understand } from './understand';
import { answerLocally } from './intents';
import { richCtx } from './testCtx';
import { toKnownLanguage } from './lexicon';

const focus = (q: string) => understand(q).focus;

describe('understand — which part of the message asks', () => {
  it('takes the clause after "but" when the part before is settled or it asks', () => {
    expect(focus('i know how to bench, but how do i fix my squat')).toBe('how do i fix my squat');
    expect(focus('my bench is fine but my deadlift is stuck')).toMatch(/my deadlift is stuck$/);
    // "…but I only have two days" is a constraint, not the point — the whole stays.
    expect(focus('i want to build muscle but i only have 2 days a week')).toBeNull();
  });

  it('keeps the positive side of a negated alternative', () => {
    expect(focus("i don't want to lose weight, i want muscle")).toBe('i want muscle');
    expect(focus('nie chcę schudnąć, chcę masę')).toBe('chcę masę');
    expect(focus('nenoriu numesti svorio, noriu masės')).toBe('noriu masės');
  });

  it('drops a clause that waves a subject away', () => {
    expect(focus('i dont care about abs, how do i grow my back')).toBe('how do i grow my back');
    expect(focus('про дієту не питаю, скільки відпочивати між підходами')).toBe(
      'скільки відпочивати між підходами',
    );
    expect(focus('nic mnie nie boli, co trenować')).toBe('co trenować');
    // "…anymore" is a way back from an injury, not a denial to drop.
    expect(focus("it doesn't hurt anymore, when can i deadlift again")).toBeNull();
  });

  it('reads the question embedded under "asks / wants to know"', () => {
    expect(focus('my girlfriend asks how much protein she needs')).toBe(
      'how much protein she needs',
    );
    expect(focus('do you know how to fix knee valgus')).toBe('how to fix knee valgus');
  });

  it('takes the condition when the main clause only asks "what now?"', () => {
    expect(focus('if i only have 30 minutes today, what should i do')).toBe(
      'i only have 30 minutes today',
    );
    expect(focus('якщо я захворію, пропускати зал?')).toBe('я захворію');
    // A real main question keeps its condition as context.
    expect(focus('if my knee hurts, should i still squat')).toBeNull();
  });

  it('puts the action of the clause before in place of "that" / "це"', () => {
    const f = focus('i am going to swim tomorrow, does that count as cardio') ?? '';
    expect(f).toMatch(/swim/);
    expect(f).toMatch(/cardio/);
    expect(f).not.toMatch(/tomorrow/);
    expect(focus('завтра піду плавати, це зараховується як кардіо?')).toMatch(/плавати/);
    // A report asked about stays whole (it is an activity to log).
    expect(focus('i went for a run, does it count?')).toBeNull();
  });

  it('drops pleasantries and request frames', () => {
    expect(focus('hey. quick one. how long should i rest between sets?')).toBe(
      'how long should i rest between sets?',
    );
    expect(focus('can you tell me my best squat')).toBe('my best squat');
    expect(focus('можеш сказати мій найкращий присід')).toBe('мій найкращий присід');
  });
});

describe('understand — who says what, in which tense', () => {
  it('tells reports from plans and questions', () => {
    expect(understand('i ran 10k this morning').report).toBe(true);
    expect(understand('przebiegłem 5 km rano').report).toBe(true);
    expect(understand('i will run 10k tomorrow, should i skip legs today').plan).toBe(true);
    expect(understand('should i squat tomorrow').report).toBe(false);
    expect(understand('did i train legs this week').pastAsk).toBe(true);
    expect(understand('how often should i train chest').pastAsk).toBe(false);
  });

  it('hears complaints at Atlas, not requests to it', () => {
    expect(understand("you didn't answer my question").complaint).toBe(true);
    expect(understand('sa ei saa minust aru').complaint).toBe(true);
    expect(understand('can you make me a 4 day program').complaint).toBe(false);
    expect(understand('forget cardio, how many sets for chest').complaint).toBe(false);
  });

  it('knows when pain is only denied, and when growth is wanted', () => {
    expect(understand('midagi ei valuta, mida treenida').painNegated).toBe(true);
    expect(understand('my knee hurts when i squat').painNegated).toBe(false);
    expect(understand('i just want to get big').wantsGrowth).toBe(true);
    expect(understand("i don't want to get bulky").wantsGrowth).toBe(false);
  });

  it('asks for advice vs asks Atlas to justify itself', () => {
    expect(understand('which split is best').advice).toBe(true);
    expect(understand('why do you always suggest squats').whyAtlas).toBe(true);
    expect(understand('why are my squats stuck').whyAtlas).toBe(false);
  });

  it('knows the language, Lithuanian ę and diacritic-less Estonian included', () => {
    expect(understand('tu manęs nesupranti').lang).toBe('lt');
    expect(understand('jooksin hommikul 5 km').lang).toBe('et');
    expect(understand('ile odpoczywać między seriami').lang).toBe('pl');
  });

  it('sees a tail with no topic of its own', () => {
    expect(bareAsk('co wybrać')).toBe(true);
    expect(bareAsk('what do you think')).toBe(true);
    expect(bareAsk('and how much protein do i need')).toBe(false);
  });

  it('is cheap: well under 5 ms a message', () => {
    const qs = [
      'i know how to bench, but how do i fix my squat',
      'якщо болить коліно, чи можна присідати',
      'jeśli boli mnie kolano, czy mogę robić przysiady',
      'kui põlv valutab, kas ma võin kükitada',
      'jei skauda kelį, ar galiu daryti pritūpimus',
      'rough week at work. barely slept. should i still go to the gym today?',
    ];
    understand('warm up'); // lexicons load once
    const t0 = performance.now();
    let n = 0;
    for (let k = 0; k < 20; k++)
      for (const q of qs) {
        understand(`${q} ${k}`);
        n++;
      }
    expect((performance.now() - t0) / n).toBeLessThan(5);
  });
});

describe('routing follows the grammar', () => {
  const ask = (q: string, prev?: string) => {
    const c = richCtx(/[Ѐ-ӿ]/u.test(q) ? 'uk' : 'en');
    const convo = prev ? (answerLocally(prev, c)?.convo ?? {}) : {};
    return answerLocally(q, c, convo);
  };

  it('answers the clause that asks', () => {
    expect(ask('i know how to bench, but how do i fix my squat')?.intent).toMatch(
      /technique_lift|squat_form/,
    );
    expect(ask('i already eat enough protein, but how many carbs do i need')?.intent).toBe('carbs');
    expect(ask('my girlfriend asks how much protein she needs')?.intent).toBe('protein');
  });

  it('does not log a question or a condition as an activity', () => {
    expect(ask('30 min cardio after lifting, good or bad')?.intent).not.toBe('activity_report');
    expect(ask('якщо я пропустив тренування, робити його завтра?')?.intent).not.toBe(
      'activity_report',
    );
    expect(ask('I danced for 2 hours today, why not commenting on that?')?.intent).toBe(
      'activity_report',
    );
    expect(ask('jooksin hommikul 5 km')?.intent).toBe('activity_report');
  });

  it('switches topic on "and what about…" when the examples clearly name another', () => {
    expect(ask('thanks. and what about carbs?', 'how much protein do i need')?.intent).toBe(
      'carbs',
    );
  });

  it('keeps a time word of the story out of the question', () => {
    expect(ask('i used to lift 5 years ago, where do i start now')?.intent).not.toBe('then_vs_now');
    expect(ask('що я робив 3 дні тому')?.intent).toBe('day_lookup');
  });

  it('hears who is asked to justify', () => {
    expect(ask('why do you always suggest squats')?.intent).toMatch(/why_lift|why_plan/);
  });
});

describe('conditions, worries and what-ifs — in every language', () => {
  const cond = (q: string) => understand(q).cond;
  const ask = (q: string) => answerLocally(q, richCtx(/[Ѐ-ӿ]/u.test(q) ? 'uk' : 'en'));

  it('knows the connector kinds', () => {
    expect(cond('unless my wrist hurts, can i do heavy curls')?.kind).toBe('neg');
    expect(cond('jei kartais susirgsiu, ar eiti į salę')?.kind).toBe('hyp');
    expect(cond('juhuks kui ma haigeks jään, kas minna trenni')?.kind).toBe('hyp');
    expect(cond('seni kuni valu pole, kas võin joosta')?.kind).toBe('while');
    expect(cond('o ile nie boli, czy mogę robić martwy ciąg')?.kind).toBe('while');
    expect(cond('nawet jeśli jestem zmęczony, czy iść na trening')?.kind).toBe('even');
    expect(cond('how do i squat deeper')).toBeNull();
  });

  it('answers the main question under "unless / as long as"', () => {
    expect(focus('unless my wrist hurts, can i do heavy curls')).toBe('can i do heavy curls');
    expect(focus('o ile nie boli, czy mogę robić martwy ciąg')).toBe('czy mogę robić martwy ciąg');
  });

  it('answers the condition when the main clause only asks to go on', () => {
    // Original letters kept, one word is enough.
    expect(focus('jei kartais susirgsiu, ar eiti į salę')).toBe('susirgsiu');
    expect(focus('nawet jeśli jestem zmęczony, czy iść na trening')).toBe('jestem zmęczony');
    expect(ask('nawet jeśli boli mnie kolano, czy mogę biegać')?.intent).toMatch(/^pain/);
  });

  it('hears a worry as a worry, not a stalled lift', () => {
    expect(understand('i am scared of failing a squat').fear).toBe(true);
    expect(understand('bijau, kad nepakelsiu štangos').fear).toBe(true);
    expect(understand('my squat is stuck').fear).toBe(false);
    expect(ask('боюся, що застрягну під штангою в присіді')?.intent).not.toBe('progress_lift');
  });

  it('answers what would happen, not what the log shows', () => {
    expect(
      understand('if i stop training for three weeks, how much strength do i lose').hypothetical,
    ).toBe(true);
    expect(ask('if i stop training for three weeks, how much strength do i lose')?.intent).toBe(
      'k_detraining',
    );
  });

  it('asks about the body, not the day or the load: "will I be stiff tomorrow?"', () => {
    expect(ask('am i going to be stiff tomorrow after deadlifts')?.intent).not.toMatch(
      /^(tomorrow|next_weight)$/,
    );
  });

  it('hears "the same answer again" as a complaint, not a request', () => {
    expect(focus('you keep giving me the same answer')).toBeNull();
    expect(ask('you always give the same answer')?.intent).toBe('you_dumb');
  });
});

describe('lexicon — word parts', () => {
  it('reads prefixed verbs, Lithuanian ne- and Estonian compounds', () => {
    expect(toKnownLanguage('zachorowałem wczoraj')).toBe('sick yesterday');
    expect(toKnownLanguage('susirgau')).toBe('sick');
    expect(toKnownLanguage('nesportuoju savaitę')).toBe('not train week');
    expect(toKnownLanguage('treeningkava')).toBe('workout plan');
    expect(toKnownLanguage('jõusaalikava')).toBe('gym plan');
  });
});
