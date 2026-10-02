import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { COACH_EFFECT_ICON, FEATURE_ICON } from './coachEffectIcons';
import { CoachAlcohol } from './views/CoachAlcohol';
import { CoachNicotine } from './views/CoachNicotine';
import { CoachSupplements } from './views/CoachSupplements';
import { AlcoholHealthRow } from './views/health/alcohol/AlcoholSection';
import { NicotineHealthGroup } from './views/health/nicotine/NicotineSection';
import { SupplementHealthRow } from './views/health/supplements/SupplementSection';
import { Icon } from './ui';

afterEach(cleanup);
const nop = () => undefined;
const glyph = (name: string) =>
  render(<Icon name={name} />).container.querySelector('i')?.innerHTML;
/** The icon markup of each row's tile, in order. */
const tiles = (c: HTMLElement) =>
  Array.from(c.querySelectorAll('.uirow')).map((r) => r.querySelector('i')?.innerHTML);

describe('coach blocks: one icon per effect, everywhere', () => {
  it('the same effect has the same icon in nicotine, alcohol and supplements', () => {
    const nic = render(
      <CoachNicotine
        view={{
          mode: 'effects',
          effects: [
            { key: 'readiness', low: 0.9, high: 0.95 },
            { key: 'sleepMin', low: -20, high: -10 },
            { key: 'rpe', low: 0.2, high: 0.5 },
          ],
        }}
      />,
    ).container;
    const alc = render(
      <CoachAlcohol
        view={{
          mode: 'effects',
          effects: [
            { key: 'readiness', low: 0.9, high: 0.95 },
            { key: 'sleepMin', low: -20, high: -10 },
          ],
        }}
      />,
    ).container;
    const sup = render(
      <CoachSupplements
        view={{
          mode: 'effects',
          effects: [
            { key: 'sleepMin', low: -10, high: 0 },
            { key: 'rpe', low: -0.5, high: -0.2 },
            { key: 'proteinGrams', low: 20, high: 20 },
          ],
        }}
      />,
    ).container;
    const [nR, nS, nE] = tiles(nic);
    const [aR, aS] = tiles(alc);
    const [sS, sE, sP] = tiles(sup);
    expect(nR).toBe(glyph(COACH_EFFECT_ICON.readiness));
    expect(aR).toBe(nR);
    expect(nS).toBe(glyph(COACH_EFFECT_ICON.sleepMin));
    expect(aS).toBe(nS);
    expect(sS).toBe(nS);
    expect(nE).toBe(glyph(COACH_EFFECT_ICON.rpe));
    expect(sE).toBe(nE);
    expect(sP).toBe(glyph(COACH_EFFECT_ICON.proteinGrams));
  });
});

describe('feature icons: Health rows, privacy rows and coach headers share one source', () => {
  it('the Lifestyle rows use FEATURE_ICON', () => {
    const nic = render(<NicotineHealthGroup onOpen={nop} />).container;
    expect(tiles(nic)[0]).toBe(glyph(FEATURE_ICON.nicotine));
    cleanup();
    expect(tiles(render(<AlcoholHealthRow onOpen={nop} />).container)[0]).toBe(
      glyph(FEATURE_ICON.alcohol),
    );
    cleanup();
    expect(tiles(render(<SupplementHealthRow onOpen={nop} />).container)[0]).toBe(
      glyph(FEATURE_ICON.supplements),
    );
  });
});
