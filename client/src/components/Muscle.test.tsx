import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FamilyFigure, litLibIds } from './Muscle';
import { FATIGUE_COLOR } from '../fatigue';

describe('FamilyFigure per-muscle colours', () => {
  it('lights each muscle path with its own colour and leaves the rest dim', () => {
    const groups = ['biceps', 'triceps', 'forearms'] as const;
    const colors = {
      biceps: FATIGUE_COLOR.fried,
      triceps: FATIGUE_COLOR.fresh,
      forearms: FATIGUE_COLOR.moderate,
    };
    const { container } = render(
      <FamilyFigure groups={[...groups]} color="red" colors={colors} view="front" />,
    );
    const fills = [...container.querySelectorAll('path')].map((p) => p.getAttribute('fill'));
    const lit = new Set(litLibIds(groups, 'front'));
    expect(lit.size).toBeGreaterThan(0);
    const litFills = fills.filter((f) => Object.values(colors).includes(f as string));
    expect(litFills.length).toBe(lit.size);
    expect(new Set(litFills).size).toBeGreaterThan(1);
    expect(fills.filter((f) => f === 'red')).toHaveLength(0);
    expect(fills.length - litFills.length).toBeGreaterThan(0);
  });

  it('falls back to the single colour when no per-muscle map is given', () => {
    const { container } = render(<FamilyFigure groups={['chest']} color="red" view="front" />);
    expect(
      [...container.querySelectorAll('path')].filter((p) => p.getAttribute('fill') === 'red')
        .length,
    ).toBe(litLibIds(['chest'], 'front').length);
  });
});
