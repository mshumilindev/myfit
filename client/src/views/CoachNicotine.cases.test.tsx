import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import type { CoachNicotineView } from '../nicotineShare';
import { CoachNicotine, coachEffectText } from './CoachNicotine';
import { roundMg } from './health/nicotine/text';

beforeEach(() => setLocale('en'));
afterEach(cleanup);

describe('coachEffectText', () => {
  it('a multiplicative effect is a signed percentage, the strongest end last', () => {
    expect(coachEffectText('readiness', 0.95, 0.97, 'min')).toBe('−3 → −5 %');
    expect(coachEffectText('readiness', 0.97, 0.95, 'min')).toBe('−3 → −5 %');
    expect(coachEffectText('restPct', 1.05, 1.1, 'min')).toBe('+5 → +10 %');
  });

  it('two ends that round to the same number collapse to one', () => {
    expect(coachEffectText('readiness', 0.95, 0.95, 'min')).toBe('−5 %');
    expect(coachEffectText('deloadThreshold', 0.9001, 0.9, 'min')).toBe('−10 %');
  });

  it('an additive effect carries the minutes unit it is given', () => {
    expect(coachEffectText('sleepMin', 5, 15, 'мин')).toBe('+5 → +15 мин');
    expect(coachEffectText('warmupMin', 2, 2, 'min')).toBe('+2 min');
  });

  it('RPE has no unit and keeps two decimals', () => {
    expect(coachEffectText('rpe', -0.25, -0.5, 'min')).toBe('−0.25 → −0.5');
  });

  it('a neutral range reads without a sign', () => {
    expect(coachEffectText('readiness', 1, 1, 'min')).toBe('0 %');
    expect(coachEffectText('sleepMin', 0, 0, 'min')).toBe('0 min');
  });
});

describe('CoachNicotine', () => {
  const effects: CoachNicotineView['effects'] = [
    { key: 'readiness', low: 0.96, high: 0.95 },
    { key: 'restPct', low: 1.05, high: 1.1 },
    { key: 'sleepMin', low: 5, high: 15 },
  ];

  it('effects mode lists each adjustment with its range and a confidence tag, plus the sharing footnote', () => {
    const { container } = render(<CoachNicotine view={{ mode: 'effects', effects }} />);
    expect(screen.getByText(en.nicFxCoachEffects)).toBeTruthy();
    expect(screen.getByText(en.nicFxCoachFoot)).toBeTruthy();
    expect(screen.getByText(en.nicSfReadiness)).toBeTruthy();
    expect(screen.getByText('−4 → −5 %')).toBeTruthy();
    // readiness and sleep have weak evidence, rest has none at all
    expect(screen.getAllByText(en.nicConfWeak)).toHaveLength(2);
    expect(screen.getByText(en.nicConfExperimental)).toBeTruthy();
    expect(screen.queryByText(en.nicFxCoachProducts)).toBeNull();
    expect(container.querySelectorAll('.uirow')).toHaveLength(3);
  });

  it('every surface carries a tag: only weak or no research stands behind any of them', () => {
    render(
      <CoachNicotine
        view={{
          mode: 'effects',
          effects: [
            { key: 'warmupMin', low: 1, high: 2 },
            { key: 'deloadThreshold', low: 0.9, high: 0.95 },
            { key: 'progressionStep', low: 0.85, high: 0.9 },
            { key: 'rpe', low: -0.5, high: -0.25 },
          ],
        }}
      />,
    );
    expect(screen.getAllByText(en.nicConfExperimental)).toHaveLength(4);
    expect(screen.queryByText(en.nicConfWeak)).toBeNull();
  });

  it('full mode adds the usual amounts and the combined load, without the "shared" footnote on effects', () => {
    const view: CoachNicotineView = {
      mode: 'full',
      effects,
      full: {
        mgPerDay: 12,
        absorbedMgPerDay: 7.2,
        cigEq: 7.25,
        products: [
          { kind: 'cigarettes', unit: 'pieces', amount: 10, strengthMg: 1 },
          { kind: 'heated', strengthMg: 1, occasional: true },
        ],
      },
    };
    render(<CoachNicotine view={view} />);
    const products = screen.getByText(en.nicFxCoachProducts).closest('section, div') as HTMLElement;
    expect(
      within(products.parentElement as HTMLElement).getByText(en.nicKind.cigarettes),
    ).toBeTruthy();
    expect(screen.getByText(en.nicFxProductSome('1'))).toBeTruthy();
    expect(screen.getByText(en.nicFxLabelledMg(12))).toBeTruthy();
    expect(screen.getByText(en.nicFxCigEq('7.3'))).toBeTruthy();
    expect(screen.getByText(en.nicFxMg(roundMg(7.2)))).toBeTruthy();
    // the footnote under the effects is dropped in full mode (it moves under the products)
    expect(screen.getAllByText(en.nicFxCoachFoot)).toHaveLength(1);
  });

  it('full mode with no effect still shows the products and no effects block', () => {
    render(
      <CoachNicotine
        view={{
          mode: 'full',
          effects: [],
          full: { mgPerDay: 1, absorbedMgPerDay: 0.6, cigEq: 0.6, products: [] },
        }}
      />,
    );
    expect(screen.queryByText(en.nicFxCoachEffects)).toBeNull();
    expect(screen.getByText(en.nicFxLoad)).toBeTruthy();
  });
});
