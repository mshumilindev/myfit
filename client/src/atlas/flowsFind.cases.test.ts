import { describe, expect, it } from 'vitest';
import { continueFlow, findStart, startFind, type Flow } from './flows';
import { richCtx } from './testCtx';

const c = richCtx('en');
const en = (e: string) => e;
const uk = (_e: string, u: string) => u;

describe('findStart', () => {
  it.each([
    'what is the exercise called where you lie down and pull the bar',
    'як називається вправа де лежиш',
    'не пам’ятаю назву вправи',
    'как называется упражнение',
    'find me an exercise for rear delts',
    'I forgot the name of it',
    'exercise where you hang and raise your knees',
  ])('asks for a name: %s', (q) => {
    expect(findStart(q)).toBe(true);
  });
  it.each(['how much should I bench', 'my knee hurts', 'what should I train today', ''])(
    'does not: %s',
    (q) => {
      expect(findStart(q)).toBe(false);
    },
  );
});

describe('find an exercise', () => {
  it('asks what you used when it cannot tell, with every equipment but the EZ bar as a chip', () => {
    const r = startFind('what is it called', c, en);
    expect(r).toMatchObject({ intent: 'find_exercise', text: 'What did you use?' });
    expect(r.chips).toEqual([
      'Barbell',
      'Dumbbells',
      'Cable',
      'Machine',
      'Kettlebell',
      'Band',
      'Bodyweight',
    ]);
    expect(r.flow).toMatchObject({
      kind: 'find',
      step: 'equipment',
      asked: ['equipment'],
      shown: [],
    });
  });
  it('asks in Ukrainian', () => {
    expect(startFind('як називається', c, uk).text).toBe('З чим ти її робив?');
  });
  it('then which muscle, then your position, each only once', () => {
    let r = startFind('what is it called', c, en);
    r = continueFlow(r.flow!, 'with a barbell', c, null, en)!;
    expect(r.text).toBe('Which muscle did it work?');
    expect(r.chips).toEqual([
      'Chest',
      'Back',
      'Legs',
      'Shoulders',
      'Biceps',
      'Triceps',
      'Abs / core',
      'Glutes',
    ]);
    expect(r.flow).toMatchObject({ step: 'muscle', asked: ['equipment', 'muscle'] });
    r = continueFlow(r.flow!, 'chest', c, null, en)!;
    // equipment and muscle are known, position is not
    expect(r.flow).toMatchObject({ step: 'position' });
    expect(r.text).toBe('And your position?');
    expect(r.chips).toEqual(['Incline', 'Lying down', 'Seated', 'Standing', 'Bent over']);
  });
  it('stops asking after three questions even if little is known, and offers the closest', () => {
    let r = startFind('what is it called', c, en);
    r = continueFlow(r.flow!, 'dunno', c, null, en)!;
    r = continueFlow(r.flow!, 'dunno', c, null, en)!;
    r = continueFlow(r.flow!, 'dunno', c, null, en)!;
    expect(r.text).not.toMatch(/^(What did you use|Which muscle|And your position)/);
    expect(r.flow).toMatchObject({ kind: 'find' });
  });
  it('offers four library exercises plus "none of these" when the description is clear', () => {
    const r = startFind(
      'the exercise where you lie down with a barbell and press it up over your chest',
      c,
      en,
    );
    expect(r.text).toBe('Is it one of these?');
    expect(r.chips).toHaveLength(5);
    expect(r.chips!.at(-1)).toBe('None of these');
    const shown = (r.flow as Extract<Flow, { kind: 'find' }>).shown;
    expect(shown).toHaveLength(4);
    expect(r.chips!.slice(0, 4)).toEqual(shown);
    expect(r.chips!.slice(0, 2).join(' ')).toMatch(/Bench|Press/i);
  });
  it('ranks by equipment: dumbbell curls ask for nothing more and put curls first', () => {
    const r = startFind('seated dumbbell biceps curl', c, en);
    expect(r.flow).toMatchObject({ step: 'pick' });
    expect(r.chips![0]).toMatch(/curl/i);
  });
  it('understands Ukrainian descriptions', () => {
    const r = startFind('вправа лежачи зі штангою на груди жим', c, en);
    expect(r.text).toBe('Is it one of these?');
    expect(r.chips![0]).toMatch(/Bench|Press/i);
  });
  it('a distinctive name needs no questions: “face pull” is offered straight away, best match first', () => {
    const r = startFind('face pull', c, en);
    expect(r.text).toBe('Is it one of these?');
    expect(r.chips![0]).toBe('Face Pull');
    expect(r.flow).toMatchObject({ step: 'pick', asked: [] });
  });
  it('picking an offered exercise names it, its muscles and ends the flow', () => {
    const offer = startFind('seated dumbbell biceps curl', c, en);
    const name = offer.chips![0];
    const r = continueFlow(offer.flow!, name, c, null, en)!;
    expect(r.flow).toBeNull();
    expect(r.text).toMatch(
      new RegExp(
        `^That's ${name.replace(/[()]/g, '.')}( — works [^.]+)?\\. You'll find it by that name`,
      ),
    );
    expect(r.chips).toEqual([`${name}: technique tips?`, `What can replace ${name}?`]);
  });
  it('picking is case/punctuation-insensitive and works in Ukrainian text', () => {
    const offer = startFind('seated dumbbell biceps curl', c, en);
    const r = continueFlow(offer.flow!, offer.chips![1].toUpperCase(), c, null, uk)!;
    expect(r.flow).toBeNull();
    expect(r.text).toMatch(/^Це /);
  });
  it('"none of these" ranks again without the ones already shown', () => {
    const offer = startFind('seated dumbbell biceps curl', c, en);
    const first = (offer.flow as Extract<Flow, { kind: 'find' }>).shown;
    const r = continueFlow(offer.flow!, 'None of these', c, null, en)!;
    const second = (r.flow as Extract<Flow, { kind: 'find' }>).shown;
    expect(second.slice(0, first.length)).toEqual(first);
    expect(second.length).toBeGreaterThan(first.length);
    for (const n of r.chips!.slice(0, -1)) expect(first).not.toContain(n);
  });
  it('new detail after an offer re-ranks everything (the offer was not rejected)', () => {
    const offer = startFind('seated dumbbell biceps curl', c, en);
    const r = continueFlow(offer.flow!, 'with a cable rope', c, null, en)!;
    const f = r.flow as Extract<Flow, { kind: 'find' }>;
    expect(f.desc).toBe('seated dumbbell biceps curl with a cable rope');
    expect(f.shown.length).toBeLessThanOrEqual(4);
  });
  it('says so when nothing in the library is close', () => {
    const r = startFind('qqqzzz xxyyww kkllmm', c, en);
    const g = continueFlow(r.flow!, 'qqq', c, null, en)!;
    const h = continueFlow(g.flow!, 'qqq', c, null, en)!;
    const last = continueFlow(h.flow!, 'qqq', c, null, en)!;
    expect(last.text).toMatch(/^Nothing close in the library yet\./);
    expect(last.flow).toMatchObject({ step: 'pick' });
    expect(last.chips).toBeUndefined();
  });
  it('a stop word cancels the search', () => {
    const r = startFind('what is it called', c, en);
    expect(continueFlow(r.flow!, 'cancel', c, null, en)).toEqual({
      intent: 'flow_cancel',
      text: 'Okay, dropped it.',
      flow: null,
    });
  });
});
