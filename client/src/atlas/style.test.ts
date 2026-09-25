import { describe, expect, it } from 'vitest';
import { styled, moodOf, type StyleCtx } from './style';
import type { Temper } from './types';

const base = (temper: Temper, seed: string, over: Partial<StyleCtx> = {}): StyleCtx => ({
  temper,
  locale: 'uk',
  yoMama: true,
  swearing: true,
  topic: 'progress_lift',
  seed,
  ...over,
});
const ANSWER = 'Жим лежачи: розрахунковий максимум 100 kg → 105 kg (+5%) з 3 черв., 12 трен.';
const seeds = Array.from({ length: 200 }, (_, i) => `q${i}`);

describe('voice constructor — the temper changes how, never what', () => {
  it('keeps every number of the answer', () => {
    for (const t of [1, 2, 3, 4, 5] as Temper[])
      for (const s of seeds.slice(0, 40)) {
        const out = styled(ANSWER, base(t, s)).text;
        for (const n of ANSWER.match(/\d+/g)!) expect(out).toContain(n);
      }
  });

  it('different tempers sound different', () => {
    const same = seeds.filter(
      (s) => styled(ANSWER, base(1, s)).text === styled(ANSWER, base(5, s)).text,
    ).length;
    expect(same).toBeLessThan(seeds.length * 0.1);
  });

  it('jokes show up, more in harder tempers, never twice in a row', () => {
    const rate = (t: Temper) =>
      seeds.filter((s) => styled(ANSWER, base(t, s)).joked).length / seeds.length;
    expect(rate(1)).toBeGreaterThan(0.08);
    expect(rate(5)).toBeGreaterThan(rate(2));
    expect(seeds.some((s) => styled(ANSWER, base(5, s, { jokedLast: true })).joked)).toBe(false);
  });

  it('“your mom” only in Drill/Merciless and only when on', () => {
    const mom = (t: Temper, on: boolean) =>
      seeds.some((s) =>
        /Твоя мама|твоєї мами/.test(styled(ANSWER, base(t, s, { yoMama: on })).text),
      );
    expect(mom(5, true)).toBe(true);
    expect(mom(4, true)).toBe(true);
    expect(mom(5, false)).toBe(false);
    expect(mom(3, true)).toBe(false);
  });

  it('swearing only in Merciless and only when on', () => {
    const sw = (t: Temper, on: boolean) =>
      seeds.some((s) =>
        /Блін|Чорт|Бляха|Трясця|Хрін|капець|блін|трясця/.test(
          styled(ANSWER, base(t, s, { swearing: on })).text,
        ),
      );
    expect(sw(5, true)).toBe(true);
    expect(sw(5, false)).toBe(false);
    expect(sw(4, true)).toBe(false);
  });

  it('pain, health and the body stay plain', () => {
    for (const s of seeds.slice(0, 50)) {
      const out = styled('Зменш вагу й покажи коліно лікарю.', base(5, s, { topic: 'pain' })).text;
      expect(out).not.toMatch(/Твоя мама|Блін|Чорт|Бляха|Трясця|Хрін|капець/);
      expect(styled('80 kg.', base(5, s, { neutral: true })).text).toBe('80 kg.');
    }
  });

  it('reads good and bad news from the answer', () => {
    expect(moodOf('Bench: 100 → 105 kg (+5%)')).toBe('good');
    expect(moodOf('Жим стоїть — додай повтор')).toBe('bad');
    expect(moodOf('Plan: 60 min')).toBeNull();
  });

  it('English works too', () => {
    const out = styled('Bench: 100 kg → 105 kg (+5%).', base(4, 'x1', { locale: 'en' })).text;
    expect(out).toMatch(/105 kg/);
    expect(out).not.toMatch(/[а-яії]/i);
  });
});
