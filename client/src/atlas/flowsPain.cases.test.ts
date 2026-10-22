import { describe, expect, it } from 'vitest';
import { continueFlow, painNow, painStart, startPain, type Flow, type FlowReply } from './flows';
import type { AskCtx, Tr } from './intentKit';
import { richCtx } from './testCtx';
import type { Workout } from '../types';

const c = richCtx('en');
const en: Tr = (e) => e;
const uk: Tr = (_e, u) => u;
const SQUAT = 'Barbell Full Squat';

/** Feed answers one by one until the flow ends (extra answers are ignored). */
function drive(first: FlowReply, answers: string[], ctx: AskCtx = c, L = en): FlowReply {
  let r = first;
  for (const a of answers) {
    if (!r.flow) break;
    r = continueFlow(r.flow as Flow, a, ctx, null, L)!;
    expect(r).not.toBeNull();
  }
  return r;
}

describe('painStart', () => {
  it.each([
    'my knee hurts after squats',
    'коліно болить після присідань',
    'мое колено болит',
    'boli mnie kolano',
    'I tweaked my back',
    'something popped in my shoulder',
    'plecho strzeliło',
    'my knees feel weird now',
    'it hurts when I squat but my knee hurts since I came back',
  ])('is a report: %s', (q) => {
    expect(painStart(q)).toBe(true);
  });
  it.each([
    'how much should I bench',
    'my knee does not hurt',
    'коліно не болить',
    'does pain hurt my gains',
    'how do I log an injury in the app',
    'which painkillers after leg day',
    'coming back after an injury',
  ])('is not a report: %s', (q) => {
    expect(painStart(q)).toBe(false);
  });
});

describe('painNow', () => {
  it('needs a body part and present pain, and no denial', () => {
    expect(painNow('knee hurts')).toBe(true);
    expect(painNow('коліно болить')).toBe(true);
    expect(painNow('knee does not hurt')).toBe(false);
    expect(painNow('it hurts')).toBe(false);
    expect(painNow('my knee is fine')).toBe(false);
  });
});

describe('pain check-in: questions', () => {
  it('starts by asking only what the message did not say, with a lead-in on the first question', () => {
    const r = startPain('my knee hurts after squats', c, SQUAT, en);
    expect(r.intent).toBe('pain');
    expect(r.text.startsWith("Let's not train through it until we know more.")).toBe(true);
    expect(r.text.endsWith('What does it feel like?')).toBe(true);
    expect(r.flow).toMatchObject({ step: 'feel', part: 'knee', lift: SQUAT, when: 'after' });
  });
  it('asks where first when no body part is named, offering every area plus "somewhere else"', () => {
    const r = startPain('ouch', c, null, en);
    expect(r.text).toMatch(/Where exactly does it hurt\?$/);
    expect(r.chips).toEqual([
      'Knee',
      'Lower back',
      'Shoulder',
      'Elbow',
      'Wrist',
      'Neck',
      'Hip',
      'Ankle',
      'Somewhere else',
    ]);
  });
  it('asks the lift question with recent lifts and a "not from an exercise" escape', () => {
    const r = startPain('my knee hurts', c, null, en);
    expect(r.flow).toMatchObject({ step: 'lift' });
    expect(r.chips!.at(-1)).toBe('Not from an exercise');
    expect(r.chips!.length).toBeGreaterThan(1);
    expect(r.chips!.length).toBeLessThanOrEqual(4);
  });
  it('speaks Ukrainian', () => {
    const r = startPain('коліно болить', c, null, uk);
    expect(r.chips!.at(-1)).toBe('Не пов’язано з вправою');
  });
  it('walks part → lift → when → feel → level → flags → form, one question at a time', () => {
    let r = startPain('it hurts', c, null, en);
    expect(r.flow).toMatchObject({ step: 'part' });
    r = continueFlow(r.flow!, 'knee', c, null, en)!;
    expect(r.flow).toMatchObject({ step: 'lift', part: 'knee' });
    r = continueFlow(r.flow!, 'Not from an exercise', c, null, en)!;
    expect(r.flow).toMatchObject({ step: 'when', lift: null });
    r = continueFlow(r.flow!, 'The next day', c, null, en)!;
    expect(r.flow).toMatchObject({ step: 'feel', when: 'nextday' });
    r = continueFlow(r.flow!, 'Dull, aching', c, null, en)!;
    expect(r.flow).toMatchObject({ step: 'level', feel: 'dull' });
    expect(r.text).toBe('How bad, 1 to 10?');
    r = continueFlow(r.flow!, '5', c, null, en)!;
    expect(r.flow).toMatchObject({ step: 'flags', level: 2 });
    expect(r.chips).toContain('None of these');
    expect(r.chips).not.toContain('Оніміння в паху чи проблеми із сечовипуском');
  });
  it('offers the groin/bladder sign only for the lower back', () => {
    const flagsChips = (q: string, lift: string) => {
      const r = startPain(q, c, lift, en);
      expect(r.flow).toMatchObject({ step: 'level' });
      return continueFlow(r.flow!, '5', c, null, en)!.chips;
    };
    expect(flagsChips('my lower back hurts during the set sharp', 'Barbell Deadlift')).toContain(
      'Numb groin or trouble peeing',
    );
    expect(flagsChips('my knee hurts during the set sharp', SQUAT)).not.toContain(
      'Numb groin or trouble peeing',
    );
  });
  it('takes severity words in the opening only when nothing else was said', () => {
    expect(startPain('мій поперек сильно болить', c, null, uk).flow).toMatchObject({
      part: 'lower_back',
      level: 3,
    });
    expect(startPain('knee hurts a bit', c, null, en).flow).toMatchObject({ level: 1 });
    expect(startPain('knee hurts moderate', c, null, en).flow).toMatchObject({ level: 2 });
    expect(startPain('мій поперек гострий під час підходу', c, null, uk).flow).toMatchObject({
      part: 'lower_back',
      when: 'during',
      feel: 'sharp',
    });
  });
  it('does not take a level word at the technique question as a severity', () => {
    const open = startPain('knee hurts after squats, dull, next day', c, SQUAT, en);
    expect(open.flow).toMatchObject({ step: 'level' });
  });
  it('reads "N of 10" in a bare opening, banding 1–3 / 4–6 / 7–10', () => {
    expect(startPain('knee hurts 3 of 10', c, SQUAT, en).flow).toMatchObject({ level: 1 });
    expect(startPain('knee hurts 4 of 10', c, SQUAT, en).flow).toMatchObject({ level: 2 });
    expect(startPain('knee hurts 6 of 10', c, SQUAT, en).flow).toMatchObject({ level: 2 });
    expect(startPain('knee hurts 7 of 10', c, SQUAT, en).flow).toMatchObject({ level: 3 });
    expect(startPain('knee hurts 10 of 10', c, SQUAT, en).flow).toMatchObject({ level: 3 });
  });
});

describe('pain check-in: answers that do not fit', () => {
  it('asks the same step again when the reply answered another question', () => {
    const r0 = startPain('knee hurts', c, null, en);
    const r1 = continueFlow(r0.flow!, 'Barbell Full Squat', c, null, en)!;
    expect(r1.flow).toMatchObject({ step: 'when', lift: SQUAT });
    const r2 = continueFlow(r1.flow!, 'sharp', c, null, en)!;
    // said the feel while asked "when" -> the question is asked again
    expect(r2.flow).toMatchObject({ step: 'when', feel: 'sharp' });
    expect(r2.text).toBe('When does it hurt?');
  });
  it('defaults a vague answer: when=after, feel=dull, level 2, flags none', () => {
    let r = startPain('it hurts', c, null, en);
    r = continueFlow(r.flow!, 'knee', c, null, en)!;
    r = continueFlow(r.flow!, 'Not from an exercise', c, null, en)!;
    r = continueFlow(r.flow!, 'dunno', c, null, en)!;
    expect(r.flow).toMatchObject({ step: 'feel', when: 'after' });
    r = continueFlow(r.flow!, 'hmm', c, null, en)!;
    expect(r.flow).toMatchObject({ step: 'level', feel: 'dull' });
    r = continueFlow(r.flow!, 'idk', c, null, en)!;
    expect(r.flow).toMatchObject({ step: 'flags', level: 2 });
    r = continueFlow(r.flow!, 'unsure', c, null, en)!;
    // no sign, level 2, dull, after training: the "train around it" verdict
    expect(r.flow).toBeNull();
    expect(r.text).toMatch(/^Train around it for 1–2 weeks/);
  });
  it('maps a bare number to the level bands 1–3 / 4–6 / 7–10', () => {
    const at = (n: string) => {
      let r = startPain('knee hurts during squats, sharp', c, SQUAT, en);
      expect(r.flow).toMatchObject({ step: 'level' });
      r = continueFlow(r.flow!, `about ${n}`, c, null, en)!;
      return (r.flow as { level?: number }).level;
    };
    expect([at('3'), at('4'), at('6'), at('7')]).toEqual([1, 2, 2, 3]);
  });
  it('a stop word ends the flow', () => {
    const r0 = startPain('knee hurts', c, null, en);
    for (const w of ['stop', 'скасуй', 'never mind', 'отмена']) {
      expect(continueFlow(r0.flow!, w, c, null, en)).toEqual({
        intent: 'flow_cancel',
        text: 'Okay, dropped it.',
        flow: null,
      });
    }
    expect(continueFlow(r0.flow!, 'стоп', c, null, uk)!.text).toBe('Добре, облишимо.');
  });
  it('an emergency named mid-check-in ends it with the safety reply', () => {
    const r0 = startPain('it hurts', c, null, en);
    const r = continueFlow(r0.flow!, 'I have chest pain and can’t breathe', c, null, en)!;
    expect(r.flow).toBeNull();
    expect(r.intent).toMatch(/^safety_/);
    expect(r.text.length).toBeGreaterThan(20);
  });
});

describe('pain check-in: verdicts', () => {
  const open = () => startPain('it hurts', c, null, en);
  it('a warning sign said up front skips the questions and sends you to a doctor (red)', () => {
    const r = startPain('my knee is swollen after squats', c, SQUAT, en);
    expect(r.flow).toBeNull();
    expect(r.intent).toBe('pain_check');
    expect(r.text).toMatch(/checked by a doctor or physio this week — swelling, numbness, locking/);
    expect(r.action).toMatchObject({
      type: 'injury',
      bodyPart: 'knee',
      stage: 'protect',
      restDays: 5,
    });
  });
  it('a denied sign is not a sign', () => {
    const r = startPain('knee hurts, no swelling', c, SQUAT, en);
    expect(r.flow).not.toBeNull();
  });
  it('a pop or being unable to load is same-day care with 7 days of rest', () => {
    for (const q of ['I heard a pop in my knee when squatting', 'my knee hurts and I can’t walk']) {
      const r = startPain(q, c, SQUAT, en);
      expect(r.flow).toBeNull();
      expect(r.text).toMatch(/^Get this checked today/);
      expect(r.action).toMatchObject({ bodyPart: 'knee', stage: 'protect', restDays: 7 });
    }
  });
  it('groin numbness, bladder trouble or fever is not a training question: safety reply', () => {
    const r = startPain('my lower back hurts and I have numb groin', c, null, en);
    expect(r.intent).toBe('safety_urgent');
    expect(r.flow).toBeNull();
  });
  it('hamstring pain is logged as the hip area', () => {
    const r = startPain('hamstring hurts sharp during deadlift', c, 'Barbell Deadlift', en);
    const end = drive(r, ['8', 'none of these', 'no']);
    expect(end.action).toMatchObject({ type: 'injury', bodyPart: 'hip' });
  });
  it('sharp pain during a set is red even at a middling level', () => {
    const end = drive(open(), [
      'knee',
      'Not from an exercise',
      'During the set',
      'Sharp, stabbing',
      '5',
      'None of these',
      'No',
    ]);
    expect(end.text).toMatch(/sharp or strong pain during a set is a stop sign/);
    expect(end.action).toMatchObject({ stage: 'protect', restDays: 5 });
  });
  it('level 7–10 is red whatever else', () => {
    const end = drive(open(), [
      'knee',
      'Not from an exercise',
      'Right after training',
      'Dull, aching',
      '9',
      'None of these',
      'No',
    ]);
    expect(end.text).toMatch(/pain this strong is a stop sign/);
  });
  it('mild tired muscle soreness is ordinary soreness: no action', () => {
    const end = drive(open(), [
      'knee',
      'Not from an exercise',
      'The next day',
      'Like tired, sore muscle',
      '2',
      'None of these',
      'No',
    ]);
    expect(end.flow).toBeNull();
    expect(end.action).toBeUndefined();
    expect(end.text).toMatch(/^Sounds like ordinary post-training soreness/);
  });
  it('a dull next-day ache at level 1 is soreness only in muscle-ish areas, not a joint', () => {
    const back = drive(startPain('it hurts', c, null, en), [
      'lower back',
      'Not from an exercise',
      'The next day',
      'Dull, aching',
      '1',
      'None of these',
    ]);
    expect(back.text).toMatch(/ordinary post-training soreness/);
    const knee = drive(startPain('it hurts', c, null, en), [
      'knee',
      'Not from an exercise',
      'The next day',
      'Dull, aching',
      '1',
      'None of these',
      'No',
    ]);
    expect(knee.text).toMatch(/^Train around it for 1–2 weeks/);
  });
  it('the middle case: train around it, with a return-stage injury offer', () => {
    const end = drive(open(), [
      'knee',
      'Not from an exercise',
      'Right after training',
      'Dull, aching',
      '5',
      'None of these',
      'No',
    ]);
    expect(end.text).toMatch(/Train around it for 1–2 weeks: cut the load on exercises for Knee/i);
    expect(end.action).toEqual({
      type: 'injury',
      bodyPart: 'knee',
      stage: 'reintroduce',
      note: 'Atlas: pain check',
    });
  });
  it('Ukrainian verdict text', () => {
    const end = drive(
      startPain('it hurts', c, null, uk),
      ['knee', 'dunno', 'during', 'sharp', '9', 'none of these', 'no'],
      c,
      uk,
    );
    expect(end.text).toMatch(/^Це варто показати лікарю/);
  });
});

describe('pain check-in: technique cue and load jump', () => {
  const sets = (w: number) => [{ id: 's', reps: 5, weight: w, isWarmup: false, position: 0 }];
  const wo = (i: number, w: number): Workout =>
    ({
      id: `w${i}`,
      startedAt: 1_000_000 - i * 86_400_000,
      finishedAt: 1_000_000 - i * 86_400_000 + 3_600_000,
      gymId: null,
      exercises: [{ id: `e${i}`, name: SQUAT, kind: 'strength', position: 0, sets: sets(w) }],
    }) as unknown as Workout;
  const withLog = (...tops: number[]): AskCtx => ({
    ...c,
    s: { ...c.s, workouts: tops.map((w, i) => wo(i, w)) },
  });
  const finish = (ctx: AskCtx, form: string) =>
    drive(
      startPain('my knee hurts after squats', ctx, SQUAT, en),
      ['during the set', 'dull', '5', 'none of these', form],
      ctx,
    );

  it('flags a jump of 8% or more between the last two sessions', () => {
    const end = finish(withLog(108, 100, 100), 'no');
    expect(end.text).toContain('Your log shows a jump: 100 kg → 108 kg (+8%) last session');
  });
  it('says nothing for 7% and when there is no earlier session', () => {
    expect(finish(withLog(107, 100), 'no').text).not.toContain('jump');
    expect(finish(withLog(120), 'no').text).not.toContain('jump');
  });
  it('gives the technique cue unless the answer was "no"; "yes" or unknown keep it', () => {
    const cue = 'Push the knees out over the toes';
    expect(finish(c, 'no').text).not.toContain(cue);
    expect(finish(c, 'yes').text).toContain(cue);
    expect(finish(c, 'not sure').text).toContain(cue);
  });
  it('has no technique question for a lift family without one: goes straight to the verdict', () => {
    const r = startPain('my knee hurts during curls', c, 'Barbell Curl', en);
    const end = drive(r, ['sharp', '5', 'none of these']);
    expect(end.flow).toBeNull();
  });
});
