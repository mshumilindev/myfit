import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// SPO-113: the exercise-card (i) sits in ONE corner with ONE inset everywhere (session cards, picker grid),
// fully inside the card, with a >= 44px touch area.
const styles = readFileSync(join(__dirname, 'styles.css'), 'utf8');
const picker = readFileSync(join(__dirname, 'components/ExercisePicker.css'), 'utf8');
const pickerTsx = readFileSync(join(__dirname, 'components/ExercisePicker.tsx'), 'utf8');
const session = readFileSync(join(__dirname, 'views/SessionView.tsx'), 'utf8');

const rule = (css: string, sel: string): string =>
  new RegExp(`(?:^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(
    css,
  )?.[1] ?? '';
const decl = (body: string, prop: string): string | null =>
  new RegExp(`${prop}:\\s*([^;]+);`).exec(body)?.[1].trim() ?? null;

describe('exercise card info button (i)', () => {
  const es = rule(styles, '.es-info');
  const xp = rule(picker, '.xp-info');
  it('session cards and picker cards use the same corner and inset', () => {
    expect(decl(es, 'top')).toBe('var(--s-8)');
    expect(decl(es, 'right')).toBe('var(--s-8)');
    expect(decl(xp, 'top')).toBe(decl(es, 'top'));
    expect(decl(xp, 'right')).toBe(decl(es, 'right'));
  });
  it('is absolutely placed on the card and the kit button does not override position', () => {
    expect(decl(es, 'position')).toBe('absolute');
    expect(decl(xp, 'position')).toBe('absolute');
    const btn = readFileSync(join(__dirname, 'components/ui/Button.css'), 'utf8');
    expect(rule(btn, '.uibtn--icon')).not.toMatch(/position:/);
  });
  it('has a 44px touch area: 28px (xs) circle + 2 x 8px / 9px reach', () => {
    expect(rule(picker, '.xp-info::after')).toMatch(/inset:\s*calc\(-1 \* var\(--s-8\)\)/);
    expect(rule(styles, '.es-info::after')).toMatch(/inset:\s*-9px/);
  });
  it('both are the same kit button (xs, photo, round) with an accessible label', () => {
    expect(pickerTsx).toMatch(
      /size="xs"\s+variant="photo"\s+shape="round"\s+className="xp-info"\s+label=\{label\}/,
    );
    expect(session).toMatch(
      /size="xs"\s+variant="photo"\s+shape="round"\s+className=\{cls\}\s+label=\{t\.detailsAction\}/,
    );
  });
});
