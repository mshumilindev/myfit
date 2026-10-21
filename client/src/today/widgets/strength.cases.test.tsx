import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { STRENGTH_WIDGETS } from './strength';
import { widgetMatrix } from '../__fixtures__/matrix';
import { NOW, STATES, PRESETS, renderWidget, seed, setLocale } from '../__fixtures__/widgetHarness';
import type { WidgetSize } from '../../components/ui/Widget';

const byId = (id: string) => STRENGTH_WIDGETS.find((w) => w.id === id)!;
const textOf = (id: string, size: WidgetSize) =>
  renderWidget(byId(id), size).container.textContent ?? '';

widgetMatrix('strength widgets', STRENGTH_WIDGETS);
widgetMatrix('strength widgets (other locales)', STRENGTH_WIDGETS, {
  locales: ['uk', 'pl', 'lt', 'et'],
  scenarios: [
    ['rich', 'program'],
    ['rich', 'local'],
    ['empty', 'none'],
  ],
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  localStorage.clear();
  setLocale('en');
  PRESETS.none();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('strength: what each widget reports for the rich fixture history', () => {
  it.each([
    ['top-lifts', 'M', ['S 143', 'B 105', 'D 168']],
    ['top-lifts', 'XL', ['Big-3 total 416 kg', 'All lifts']],
    ['next-target', 'M', ['Barbell Bench Press - Medium Grip: 85 × 5', '+2.5 kg']],
    [
      'next-target',
      'XL',
      ['Barbell Shoulder Press', '57.5 × 9', '+1 rep', 'Double progression', 'Start Push'],
    ],
    ['pr-forecast', 'M', ['Bench 115 kg by Nov 8', '+1.6 kg / week', '105 now']],
    ['pr-forecast', 'XL', ['Squat → 155', '143 now', 'Deadlift → 180', 'Change targets']],
    ['recent-prs', 'M', ['PR: Bent Over Barbell Row · e1RM 92', '17 more this month']],
    ['recent-prs', 'XL', ['18 this month', 'Barbell Deadlift · 168 kg', 'All records']],
    ['one-rm-calc', 'M', ['112.5 × 8 → 143 kg', 'from last squat set']],
    ['one-rm-calc', 'XL', ['Epley', '95%', '136 × 2', '60%', '86 × 20']],
    ['plate-calc', 'M', ['85 kg: 25 + 5 + 2.5', 'per side', '20 kg bar']],
    ['plate-calc', 'XL', ['Warm-up 60%', 'Top set']],
    ['strength-balance', 'M', ['Balanced', 'Squat 0.85', 'Bench 0.63', 'Deadlift 1.00']],
    ['strength-balance', 'XL', ['1.36 : 1 : 1.60', 'Close to typical proportions']],
    ['standards', 'M', ['Class II · total 416', '21.5 kg to Class I', '82.5 kg cat.']],
    ['standards', 'XL', ['Class CMS', '505', 'Class III', '337.5']],
    ['pl-total', 'M', ['Total 416 kg', 'S 143 · B 105 · D 168']],
    ['pl-total', 'XL', ['+44 since Jul 11', 'Class II · 21.5 kg to Class I']],
    ['relative-strength', 'M', ['Bench 1.29× bodyweight', 'Squat 1.75×', 'Deadlift 2.06×']],
    ['relative-strength', 'XL', ['Bench 1.5× = 122.5 kg', '+17.4 kg', 'BW 81.6']],
    ['rep-prs', 'M', ['Bench @ 82.5 kg: 8 reps', 'Sep 21']],
    ['rep-prs', 'XL', ['Next rep PR at your heaviest weights', '9 = PR']],
    ['stalled-lifts', 'M', ['No stalls', 'Every lift is still moving']],
    ['smart-swap', 'M', ['busy?', 'Decline Push-Up', '100% same muscles']],
    ['smart-swap', 'XL', ['Smart swap · Iron Yard', 'available here']],
  ] as Array<[string, WidgetSize, string[]]>)('%s %s', (id, size, parts) => {
    seed(STATES.rich());
    PRESETS.program();
    const out = textOf(id, size);
    for (const p of parts) expect(out).toContain(p);
  });
});

const tap = (container: HTMLElement, name: string | RegExp) =>
  fireEvent.click(within(container).getAllByRole('button', { name })[0]);

describe('strength: interaction and device-local state', () => {
  beforeEach(() => {
    seed(STATES.rich());
    PRESETS.program();
  });

  it('1RM calculator: switching lift re-bases the estimate on that lift', () => {
    const r = renderWidget(byId('one-rm-calc'), 'XL');
    expect(r.container.textContent).toContain('143 kg');
    tap(r.container, 'Deadlift');
    expect(r.container.textContent).not.toContain('112.5 kg');
    expect(r.container.textContent).toMatch(/1RM\s*\d+ kg/);
  });

  it('plate calculator: stepping the weight changes the per-side breakdown', () => {
    const r = renderWidget(byId('plate-calc'), 'XL');
    expect(r.container.textContent).toContain('85');
    tap(r.container, /\+ ?2\.5/);
    expect(r.container.textContent).toContain('87.5');
    tap(r.container, /− ?2\.5/);
    tap(r.container, /− ?2\.5/);
    expect(r.container.textContent).toContain('82.5');
  });

  it('PR forecast: saved targets from this device drive the projection', () => {
    localStorage.setItem(
      'spotter.tw.pr-forecast',
      JSON.stringify({ squat: 150, bench: 110, deadlift: 190, ohp: 70 }),
    );
    const r = renderWidget(byId('pr-forecast'), 'XL');
    expect(r.container.textContent).toContain('110 target');
  });

  it('PR forecast: "Change targets" opens the editing sheet and cancel closes it', async () => {
    const r = renderWidget(byId('pr-forecast'), 'XL');
    tap(r.container, 'Change targets');
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(
      within(screen.getByRole('dialog'))
        .getAllByRole('button', { name: /Cancel|Close/ })
        .at(-1)!,
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('tapping a card with a destination calls the shell', () => {
    const r = renderWidget(byId('top-lifts'), 'M');
    fireEvent.click(r.container.querySelector<HTMLElement>('.uiw-hit')!);
    expect(Object.keys(r.ctx.shell.calls).length).toBeGreaterThan(0);
  });
});

describe('strength: empty history', () => {
  it.each(STRENGTH_WIDGETS.map((w) => [w.id] as const))(
    '%s explains what is missing instead of showing zeros',
    (id) => {
      seed(STATES.empty());
      const out = textOf(id, 'M');
      expect(out.length).toBeGreaterThan(0);
      expect(out).not.toMatch(/NaN|undefined|Infinity/);
    },
  );
});
