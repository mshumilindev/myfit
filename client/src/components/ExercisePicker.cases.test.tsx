import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { LOCALES, fmtSet, setLocale } from '../i18n';
import { __getStateForTests, __replaceStateForTests } from '../store';
import { BUILT_IN_CATALOG } from '../data/exercises';
import { FAMILIES, type PickItem } from '../picker';
import type { Gym, Workout } from '../types';

vi.mock('../data/exercises', async (orig) => ({
  ...(await orig<typeof import('../data/exercises')>()),
  loadExerciseInstructions: vi.fn(async () => [
    'Set up under the bar.',
    'Brace and press.',
    'Lower with control.',
  ]),
}));

import { ExercisePicker, type ExercisePickerProps } from './ExercisePicker';

const en = () => LOCALES.en;
const NOW = new Date(2026, 8, 15, 12, 0).getTime();
const DAY = 86400000;
const bench = BUILT_IN_CATALOG.find((c) => c.muscle === 'chest' && /bench press/i.test(c.names[0]))!
  .names[0];

function mql(desktop: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: desktop && q.includes('min-width'),
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as never;
}
const workout = (over: Partial<Workout> = {}): Workout => ({
  id: 'cur',
  startedAt: NOW - 600000,
  finishedAt: null,
  autoFinished: false,
  exercises: [],
  ...over,
});
const done = (
  id: string,
  name: string,
  sets: Array<[number, number | null]>,
  finishedAt: number,
): Workout =>
  workout({
    id,
    startedAt: finishedAt - 3600000,
    finishedAt,
    exercises: [
      {
        id: `${id}-e`,
        name,
        position: 0,
        sets: sets.map(([reps, weight], i) => ({
          id: `${id}-s${i}`,
          reps,
          weight,
          isWarmup: false,
        })),
      } as never,
    ],
  });
const setWorkouts = (workouts: Workout[]) =>
  __replaceStateForTests({ ...__getStateForTests(), workouts } as never);
const gym = (inventory?: string[]): Gym =>
  ({ id: 'g1', name: 'Iron', lat: 0, lng: 0, radiusM: 100, inventory }) as Gym;

function setup(over: Partial<ExercisePickerProps> = {}) {
  const props = {
    workout: workout(),
    gym: null,
    onPick: vi.fn(),
    onMarker: vi.fn(),
    onCardio: vi.fn(),
    onCreate: vi.fn(),
    onClose: vi.fn(),
    ...over,
  } as ExercisePickerProps &
    Record<'onPick' | 'onMarker' | 'onCardio' | 'onCreate' | 'onClose', ReturnType<typeof vi.fn>>;
  const view = render(<ExercisePicker {...props} />);
  return { ...props, ...view };
}
const famTile = (name: string) =>
  screen
    .getAllByText(name)
    .map((n) => n.closest('button'))
    .find(Boolean)!;
const openFamily = (id: (typeof FAMILIES)[number]['id']) =>
  fireEvent.click(famTile(en().pickFamilies[id]));
const search = (v: string) => {
  const input = screen.getByPlaceholderText(en().pickSearch);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: v } });
};

beforeEach(() => {
  setLocale('en');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  mql(false);
  setWorkouts([]);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ExercisePicker · phone home', () => {
  it('shows the title, the kind switch and one tile per muscle family', () => {
    setup();
    expect(screen.getByText(en().addExercise)).toBeTruthy();
    expect(document.querySelectorAll('.xp-fam')).toHaveLength(FAMILIES.length);
    for (const f of FAMILIES) expect(famTile(en().pickFamilies[f.id])).toBeTruthy();
    expect(screen.getByText(en().pickOrGroup)).toBeTruthy();
  });

  it('"Replace exercise" and warm-up titles', () => {
    const a = setup({ replacing: true });
    expect(screen.getByText(en().replaceExercise)).toBeTruthy();
    a.unmount();
    setup({ warmup: true });
    expect(screen.getByText(en().wuPickTitle)).toBeTruthy();
  });

  it('the kind switch hands off warm-up, cool-down and cardio but stays on strength', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: en().exerciseKindNames.warmup }));
    expect(p.onMarker).toHaveBeenLastCalledWith('warmup');
    fireEvent.click(screen.getByRole('button', { name: en().exerciseKindNames.cooldown }));
    expect(p.onMarker).toHaveBeenLastCalledWith('cooldown');
    fireEvent.click(screen.getByRole('button', { name: en().exerciseKindNames.cardio }));
    expect(p.onCardio).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: en().exerciseKindNames.strength }));
    expect(p.onMarker).toHaveBeenCalledTimes(2);
  });

  it('works without the optional handlers', () => {
    render(
      <ExercisePicker
        workout={workout()}
        gym={null}
        onPick={() => undefined}
        onClose={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: en().exerciseKindNames.cardio }));
    fireEvent.click(screen.getByRole('button', { name: en().exerciseKindNames.warmup }));
    expect(screen.getByText(en().addExercise)).toBeTruthy();
  });

  it('lists what was already done in this session', () => {
    setup({
      workout: workout({
        exercises: [
          {
            id: 'x',
            name: bench,
            position: 0,
            sets: [{ id: 's', reps: 8, weight: 60, isWarmup: false }],
          } as never,
        ],
      }),
    });
    expect(screen.getByText(en().pickDoneToday(bench))).toBeTruthy();
    expect(screen.getByText(new RegExp(`${en().pickNDone(1)}`))).toBeTruthy();
  });

  it('suggests from history, with a reason and a target', () => {
    setWorkouts([
      done(
        'h1',
        bench,
        [
          [8, 60],
          [8, 60],
        ],
        NOW - 3 * DAY,
      ),
      done('h2', bench, [[8, 62.5]], NOW - 10 * DAY),
    ]);
    setup();
    expect(document.querySelectorAll('.xp-best').length).toBeGreaterThan(0);
    expect(document.querySelector('.xp-sugs-wrap .xp-label')!.textContent).toMatch(
      /^Suggested for/,
    );
    expect(document.querySelector('.xp-sug-target')!.textContent).toBeTruthy();
  });

  it('tapping a suggestion adds it', () => {
    setWorkouts([done('h1', bench, [[8, 60]], NOW - 3 * DAY)]);
    const p = setup();
    fireEvent.click(document.querySelector('.xp-best-main') as HTMLElement);
    expect(p.onPick).toHaveBeenCalledTimes(1);
    expect(p.onPick.mock.calls[0][0].name).toBeTruthy();
  });
});

describe('ExercisePicker · muscle group', () => {
  it('opens a group: header, sub-muscle chips, "best now", and a 24-card grid with paging', () => {
    setup();
    openFamily('chest');
    expect(screen.getByRole('button', { name: en().pickBackToGroups })).toBeTruthy();
    expect(document.querySelector('.xp-chips')).toBeTruthy();
    const cards = () => document.querySelectorAll('.xp-grid .xp-card');
    expect(cards()).toHaveLength(24);
    const more = screen.getByRole('button', { name: /Show \d+ more/ });
    fireEvent.click(more);
    expect(cards().length).toBeGreaterThan(24);
    fireEvent.click(screen.getByRole('button', { name: en().pickBackToGroups }));
    expect(document.querySelectorAll('.xp-fam')).toHaveLength(FAMILIES.length);
  });

  it('a card adds the exercise, with its muscles and equipment as meta', () => {
    const p = setup();
    openFamily('chest');
    const card = document.querySelector('.xp-grid .xp-card .xp-card-main') as HTMLElement;
    fireEvent.click(card);
    const item = p.onPick.mock.calls[0][0] as PickItem;
    expect(item.primary).toBeTruthy();
    expect(card.textContent).toContain(item.name);
  });

  it('sub-muscle chips filter the grid and show in the header', () => {
    setup();
    openFamily('arms');
    const chips = [...document.querySelectorAll('.xp-chips .xp-chip')] as HTMLElement[];
    expect(chips[0].textContent).toContain(en().pickAll);
    const before = document.querySelectorAll('.xp-grid .xp-card').length;
    fireEvent.click(chips.find((c) => c.textContent!.includes('Biceps'))!);
    expect(document.querySelector('.xp-head.gh .xp-label')!.textContent).toMatch(/^Biceps · \d+/);
    expect(document.querySelectorAll('.xp-grid .xp-card').length).toBeLessThanOrEqual(before);
    fireEvent.click(chips[0]);
    expect(document.querySelector('.xp-head.gh .xp-label')!.textContent).toContain(
      en().pickFamilies.arms,
    );
  });

  it('the equipment row switches between Any and one kind of kit', () => {
    setup();
    openFamily('chest');
    const radios = () => [...document.querySelectorAll('.xp-eqrow [role=radio]')] as HTMLElement[];
    expect(radios()[0].getAttribute('aria-checked')).toBe('true');
    const barbell = radios().find((r) => r.textContent!.startsWith(en().equipmentNames.barbell))!;
    fireEvent.click(barbell);
    expect(barbell.getAttribute('aria-checked')).toBe('true');
    expect(radios()[0].getAttribute('aria-checked')).toBe('false');
    const shown = document.querySelectorAll('.xp-grid .xp-card').length;
    expect(shown).toBeGreaterThan(0);
    fireEvent.click(barbell); // tap again to clear
    expect(radios()[0].getAttribute('aria-checked')).toBe('true');
  });

  it('the group search icon opens search and Cancel returns to the group', () => {
    setup();
    openFamily('core');
    fireEvent.click(screen.getByRole('button', { name: en().pickSearchShort }));
    expect(document.querySelector('.xp-results')).toBeTruthy();
    fireEvent.click(document.querySelector('.xp-cancel') as HTMLElement);
    expect(document.querySelector('.xp-results')).toBeNull();
  });

  it('an info button opens the detail sheet; Add picks and closes it, Back just closes', () => {
    const p = setup();
    openFamily('chest');
    fireEvent.click(document.querySelector('.xp-grid .xp-card .xp-info') as HTMLElement);
    const sheet = () => document.querySelector('.xp-detail-sheet') as HTMLElement;
    expect(sheet()).toBeTruthy();
    expect(p.onPick).not.toHaveBeenCalled();
    fireEvent.click(within(sheet()).getByRole('button', { name: en().backAction }));
    expect(sheet()).toBeNull();
    fireEvent.click(document.querySelector('.xp-grid .xp-card .xp-info') as HTMLElement);
    fireEvent.click(within(sheet()).getByRole('button', { name: en().pickAddToSession }));
    expect(p.onPick).toHaveBeenCalledTimes(1);
    expect(sheet()).toBeNull();
  });

  it('a custom add label reaches the detail sheet', () => {
    setup({ addLabel: 'Add to day' });
    openFamily('chest');
    fireEvent.click(document.querySelector('.xp-grid .xp-card .xp-info') as HTMLElement);
    expect(
      within(document.querySelector('.xp-detail-sheet') as HTMLElement).getByRole('button', {
        name: 'Add to day',
      }),
    ).toBeTruthy();
  });
});

describe('ExercisePicker · gym equipment', () => {
  it('items the gym cannot equip are dimmed and listed last', () => {
    setup({ gym: gym(['dumbbell']) });
    openFamily('chest');
    const cards = [...document.querySelectorAll('.xp-grid .xp-card')];
    const firstNa = cards.findIndex((c) => c.classList.contains('na'));
    expect(firstNa).toBeGreaterThan(0);
    expect(cards.slice(firstNa).every((c) => c.classList.contains('na'))).toBe(true);
  });

  it('the Equipment chip opens the filter; tiles toggle, Reset clears, Show N applies', () => {
    setup({ gym: gym(['dumbbell', 'barbell']) });
    fireEvent.click(screen.getByRole('button', { name: en().pickEquipAll }));
    const sheet = () => document.querySelector('.xp-equip-sheet') as HTMLElement;
    expect(within(sheet()).getByText(en().pickEquipTitle)).toBeTruthy();
    const tile = (n: string) => within(sheet()).getByText(n).closest('button') as HTMLElement;
    expect(within(tile(en().equipmentNames.dumbbell)).getByText(en().pickInGym)).toBeTruthy();
    expect(within(tile(en().equipmentNames.cable)).getByText(en().pickNotInGym)).toBeTruthy();
    expect(within(tile(en().equipmentNames.body)).getByText(en().pickAlways)).toBeTruthy();
    const showBtn = () => within(sheet()).getByRole('button', { name: /^Show \d+ exercises$/ });
    const all = showBtn().textContent;
    fireEvent.click(tile(en().equipmentNames.dumbbell));
    expect(tile(en().equipmentNames.dumbbell).getAttribute('aria-pressed')).toBe('true');
    expect(showBtn().textContent).not.toBe(all);
    fireEvent.click(within(sheet()).getByRole('button', { name: en().pickReset }));
    expect(tile(en().equipmentNames.dumbbell).getAttribute('aria-pressed')).toBe('false');
    expect(showBtn().textContent).toBe(all);
    fireEvent.click(tile(en().equipmentNames.dumbbell));
    fireEvent.click(tile(en().equipmentNames.barbell));
    fireEvent.click(tile(en().equipmentNames.barbell)); // off again
    fireEvent.click(showBtn());
    expect(sheet()).toBeNull();
    expect(screen.getByRole('button', { name: en().pickEquipN(1) })).toBeTruthy();
  });

  it('the "only what this gym has" switch exists only for gyms with an inventory and changes the count', () => {
    const a = setup({ gym: gym(['dumbbell']) });
    fireEvent.click(screen.getByRole('button', { name: en().pickEquipAll }));
    const sheet = () => document.querySelector('.xp-equip-sheet') as HTMLElement;
    const sw = within(sheet()).getByRole('switch', { name: en().pickOnlyGym });
    const showN = () =>
      Number(
        within(sheet())
          .getByRole('button', { name: /^Show \d+ exercises$/ })
          .textContent!.match(/\d+/)![0],
      );
    const restricted = showN();
    fireEvent.click(sw);
    expect(showN()).toBeGreaterThan(restricted);
    a.unmount();
    setup({ gym: null });
    fireEvent.click(screen.getByRole('button', { name: en().pickEquipAll }));
    expect(
      within(document.querySelector('.xp-equip-sheet') as HTMLElement).queryByRole('switch'),
    ).toBeNull();
  });

  it('dismissing the filter sheet applies nothing', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: en().pickEquipAll }));
    const sheet = () => document.querySelector('.xp-equip-sheet');
    fireEvent.click((sheet() as HTMLElement).querySelector('.xp-equip-tile') as HTMLElement); // pick something, then bail out
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(sheet()).toBeNull());
    expect(screen.getByRole('button', { name: en().pickEquipAll })).toBeTruthy(); // still "Equipment", not "Equipment · 1"
  });
});

describe('ExercisePicker · search', () => {
  it('typing switches to results ranked best-first and shows the count', () => {
    setup();
    search('bench');
    const label = document.querySelector('.xp-results .xp-label')!.textContent!;
    const n = Number(label.match(/(\d+)$/)![1]);
    expect(n).toBeGreaterThan(0);
    expect(document.querySelectorAll('.xp-results .xp-row').length).toBe(Math.min(24, n));
    const names = [...document.querySelectorAll('.xp-row-name')].map((e) =>
      e.textContent!.toLowerCase(),
    );
    expect(names[0].startsWith('bench') || names[0].includes('bench')).toBe(true);
  });

  it('Enter in the search box picks the top result', () => {
    const p = setup({ plain: true });
    search('bench');
    const top = document.querySelector('.xp-row-name')!.textContent;
    fireEvent.keyDown(screen.getByPlaceholderText(en().pickSearch), { key: 'Enter' });
    expect(p.onPick.mock.calls[0][0].name).toBe(top);
  });

  it('tapping a row picks it; its info button opens details', () => {
    const p = setup();
    search('squat');
    fireEvent.click(document.querySelector('.xp-row .xp-info') as HTMLElement);
    expect(document.querySelector('.xp-detail-sheet')).toBeTruthy();
    fireEvent.click(document.querySelector('.xp-row-main') as HTMLElement);
    expect(p.onPick).toHaveBeenCalledTimes(1);
  });

  it('offers "Create “…”" for an unknown name, and Enter creates it when nothing matches', () => {
    const p = setup();
    search('zzqqxxyy');
    expect(document.querySelector('.xp-results .xp-label')!.textContent).toBe(en().pickResults(0));
    fireEvent.click(screen.getByRole('button', { name: en().createExercise('zzqqxxyy') }));
    expect(p.onCreate).toHaveBeenLastCalledWith('zzqqxxyy');
    search('  trim me  ');
    fireEvent.keyDown(screen.getByPlaceholderText(en().pickSearch), { key: 'Enter' });
    expect(p.onCreate).toHaveBeenLastCalledWith('trim me');
  });

  it('does not offer Create for an exact existing name', () => {
    setup();
    search(bench.toLowerCase());
    expect(
      screen.queryByRole('button', { name: new RegExp(`^${en().createExercise('').slice(0, 6)}`) }),
    ).toBeNull();
  });

  it('offers "Browse all of …" for the top result\'s group and opens it', () => {
    setup();
    search('bench');
    const browse = document.querySelector('.xp-browse') as HTMLElement;
    expect(browse.textContent).toMatch(/^Browse all of /);
    fireEvent.click(browse);
    expect(document.querySelector('.xp-results')).toBeNull();
    expect(screen.getByRole('button', { name: en().pickBackToGroups })).toBeTruthy();
  });

  it('a long result list pages by 24 and caps at 60', () => {
    setup();
    search('e');
    expect(document.querySelectorAll('.xp-results .xp-row')).toHaveLength(24);
    fireEvent.click(screen.getByRole('button', { name: /Show \d+ more/ }));
    expect(document.querySelectorAll('.xp-results .xp-row')).toHaveLength(48);
    fireEvent.click(screen.getByRole('button', { name: /Show 12 more/ }));
    expect(document.querySelectorAll('.xp-results .xp-row')).toHaveLength(60);
  });

  it('Cancel leaves search and clears the text', () => {
    setup();
    search('bench');
    fireEvent.click(document.querySelector('.xp-cancel') as HTMLElement);
    expect((screen.getByPlaceholderText(en().pickSearch) as HTMLInputElement).value).toBe('');
    expect(document.querySelector('.xp-results')).toBeNull();
  });

  it('exercises already done today are flagged in the results', () => {
    setup({
      workout: workout({
        exercises: [
          {
            id: 'x',
            name: bench,
            position: 0,
            sets: [{ id: 's', reps: 8, weight: 60, isWarmup: false }],
          } as never,
        ],
      }),
    });
    search(bench);
    const row = [...document.querySelectorAll('.xp-row')].find(
      (r) => r.querySelector('.xp-row-name')!.textContent === bench,
    )!;
    expect(row.querySelector('.xp-badge')!.textContent).toBe(en().pickDoneBadge);
    expect(row.querySelector('.xp-row-meta')!.textContent).toBe(en().pickAgain(fmtSet(60, 8)));
  });

  it('exercises you have logged before are marked "Yours"', () => {
    setWorkouts([done('h1', bench, [[8, 60]], NOW - 5 * DAY)]);
    setup();
    openFamily('chest');
    const card = [...document.querySelectorAll('.xp-grid .xp-card')].find(
      (r) => r.querySelector('.xp-card-name')!.textContent === bench,
    )!;
    expect(card.querySelector('.xp-badge')!.textContent).toBe(en().pickYours);
  });
});

describe('ExercisePicker · plain (program authoring) and warm-up modes', () => {
  it('plain mode has no suggestions, readiness or done strip, and marks added names', () => {
    setWorkouts([done('h1', bench, [[8, 60]], NOW - 3 * DAY)]);
    setup({ plain: true, subtitle: 'Mon · Upper A', added: [bench] });
    expect(screen.getByText('Mon · Upper A')).toBeTruthy();
    expect(document.querySelector('.xp-best')).toBeNull();
    expect(document.querySelector('.xp-fam-state')).toBeNull();
    expect(document.querySelector('.xp-today')).toBeNull();
    search(bench);
    const row = [...document.querySelectorAll('.xp-row')].find(
      (r) => r.querySelector('.xp-row-name')!.textContent === bench,
    )!;
    expect(row.querySelector('.xp-badge')!.textContent).toBe(en().pgAdded);
  });

  it('plain mode group header shows the subtitle and cards the Added badge', () => {
    setup({ plain: true, subtitle: 'Mon · Upper A', added: [bench] });
    openFamily('chest');
    expect(document.querySelector('.xp-ghead-sub')!.textContent).toBe('Mon · Upper A');
    expect(document.querySelector('.xp-best')).toBeNull();
    const cards = [...document.querySelectorAll('.xp-grid .xp-card')];
    expect(cards.some((c) => c.querySelector('.xp-badge.done')?.textContent === en().pgAdded)).toBe(
      true,
    );
  });

  it('warm-up mode drops the kind switch and "Create" but keeps search', () => {
    setup({ warmup: true });
    expect(screen.queryByRole('button', { name: en().exerciseKindNames.cardio })).toBeNull();
    search('zzqqxxyy');
    expect(screen.queryByRole('button', { name: en().createExercise('zzqqxxyy') })).toBeNull();
  });

  it("warm-up mode suggests the auto warm-up for today's muscles", () => {
    setup({ warmup: true, workout: workout({ targetMuscles: ['chest'] }) });
    expect(document.querySelectorAll('.xp-sugs-wrap .xp-row').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.xp-fam')).toHaveLength(FAMILIES.length);
  });
});
