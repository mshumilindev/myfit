import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { setLocale, type LocaleId } from '../../i18n';
import { en } from '../../i18n/en';
import { __getStateForTests, __replaceStateForTests } from '../../store';
import { DAY, emptyState, NOW, freezeClock, setDesktop } from '../__fixtures__/viewKit';

const m = vi.hoisted(() => ({ role: 'member' as string }));
vi.mock('../../api', async (orig) => ({
  ...(await orig<typeof import('../../api')>()),
  getRole: () => m.role,
}));
vi.mock('../../coach/client/lazy', () => ({
  ClientProgramExtrasLazy: () => null,
  ClientTrainerDayTagLazy: ({ dow }: { dow: number }) => <span data-testid="daytag">{dow}</span>,
}));

import { makeSelfCatalog, selfCatalog, useSelfEditorHost } from './selfEditor';
import { SelfExercisePicker } from './selfPicker';

const withCondition = (key: string, over: Record<string, unknown> = {}) => {
  __replaceStateForTests({
    ...emptyState(),
    conditions: [{ id: 'c1', key, severity: 2, share: 'off', createdAt: NOW - DAY, ...over }],
  } as never);
};

beforeEach(() => {
  freezeClock();
  setLocale('en');
  m.role = 'member';
  __replaceStateForTests(emptyState());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('selfCatalog', () => {
  it('describes an exercise: muscles, equipment, force and no flag', () => {
    const f = selfCatalog.facts('Barbell Bench Press - Medium Grip');
    expect(f.name).toBe('Barbell Bench Press - Medium Grip');
    expect(f.primary).toBe('chest');
    expect(f.muscles).toEqual([f.primary, ...f.secondary]);
    expect(f.secondary).not.toContain('chest');
    expect(f.equipment).toBe('barbell');
    expect(f.image).toContain('Barbell_Bench_Press_-_Medium_Grip');
    expect(f.force).toBe('push');
    expect(f.flag).toBeNull();
  });

  it('an unknown name has no primary muscle and no force', () => {
    const f = selfCatalog.facts('Zzz Nonexistent Lift');
    expect(f.primary).toBeNull();
    expect(f.muscles).toEqual(f.secondary);
    expect(f.force).toBeNull();
  });

  it('search honours the limit, the muscle filter and the exclusion list (case-insensitively)', () => {
    const all = selfCatalog.search({ query: 'press', limit: 5 });
    expect(all.length).toBeGreaterThan(0);
    expect(all.length).toBeLessThanOrEqual(5);
    const first = all[0].name;
    const without = selfCatalog.search({
      query: 'press',
      limit: 5,
      exclude: [first.toUpperCase()],
    });
    expect(without.map((h) => h.name)).not.toContain(first);
    const chest = selfCatalog.search({ query: '', muscle: 'chest', limit: 6 });
    expect(chest.length).toBeGreaterThan(0);
    expect(chest[0].muscle).toBe('chest');
    expect(chest.map((h) => h.id)).not.toEqual(
      selfCatalog.search({ query: '', limit: 6 }).map((h) => h.id),
    );
    expect(selfCatalog.search({ limit: 3 }).length).toBeLessThanOrEqual(3);
  });

  it('flags come from the supplied function', () => {
    const cat = makeSelfCatalog((n) =>
      n === 'Barbell Squat' ? { level: 'avoid', label: 'x' } : null,
    );
    expect(cat.facts('Barbell Squat').flag).toEqual({ level: 'avoid', label: 'x' });
    expect(cat.facts('Barbell Bench Press').flag).toBeNull();
    const hit = makeSelfCatalog(() => ({ level: 'caution', label: 'c' })).search({
      query: 'squat',
      limit: 2,
    });
    expect(hit.every((h) => h.flag?.level === 'caution')).toBe(true);
  });
});

describe('useSelfEditorHost: health flags', () => {
  const flagFor = (name: string) => {
    const { result } = renderHook(() => useSelfEditorHost());
    return result.current.catalog.facts(name).flag;
  };

  it('no conditions: nothing is flagged', () => {
    expect(flagFor('Barbell Deadlift')).toBeNull();
  });

  it('a disc condition marks heavy spinal lifts as not advised', () => {
    withCondition('back_lumbar_disc');
    expect(flagFor('Barbell Deadlift')).toEqual({ level: 'avoid', label: en.pickNotAdvised });
    expect(flagFor('Barbell Bench Press')).toBeNull();
  });

  it('a milder condition marks the same kind of lift as "be careful"', () => {
    withCondition('back_lumbar_chronic');
    const levels = ['Barbell Squat', 'Barbell Deadlift', 'Overhead Press', 'Walking Lunge']
      .map(flagFor)
      .filter(Boolean);
    expect(levels.length).toBeGreaterThan(0);
    expect(levels.some((f) => f?.level === 'caution' && f.label === en.pickCareful)).toBe(true);
  });

  it("a coach writing someone else's program is not flagged by their own limits", () => {
    withCondition('back_lumbar_disc');
    m.role = 'trainer';
    expect(flagFor('Barbell Deadlift')).toBeNull();
  });

  it('an ended temporary condition no longer flags', () => {
    withCondition('back_lumbar_disc', { startedAt: NOW - 20 * DAY, endsAt: NOW - DAY });
    const { conditions } = __getStateForTests();
    expect(conditions).toHaveLength(1);
    expect(flagFor('Barbell Deadlift')).toBeNull();
  });
});

describe('useSelfEditorHost: options', () => {
  const host = (o?: Parameters<typeof useSelfEditorHost>[0]) =>
    renderHook(() => useSelfEditorHost(o)).result.current;

  it('is the athlete (self) mode with targets on new rows and the equipment catalog', () => {
    const h = host();
    expect(h.mode).toBe('self');
    expect(h.newRows).toBe('targets');
    expect(h.equipment.length).toBeGreaterThan(5);
    expect(h.activities.length).toBeGreaterThan(3);
    expect(h.weekOrder).toHaveLength(7);
    expect(h.canonicalName?.('bench press')).toBeTruthy();
  });

  it('lists the cardio machines the app can calculate for, with an icon each', () => {
    const h = host();
    expect(h.cardio?.length ?? 0).toBeGreaterThan(2);
    expect(h.cardio?.every((c) => c.name && c.icon)).toBe(true);
  });

  it('activities are switched off while the sealed list cannot be opened', () => {
    expect(host().features?.activities).toBe(true);
    expect(host({ activitiesLocked: true }).features?.activities).toBe(false);
  });

  it('exercise links open the details and the history through the shell, and are absent without one', () => {
    expect(host().exerciseLinks).toBeUndefined();
    const openOverlay = vi.fn();
    const links = host({ shell: { openOverlay } }).exerciseLinks!('Barbell Squat');
    expect(links.map((l) => l.label)).toEqual([en.pgDetailsOf('Barbell Squat'), en.openHistory]);
    links[0].onClick();
    links[1].onClick();
    expect(openOverlay).toHaveBeenNthCalledWith(1, {
      screen: 'exercise-detail',
      name: 'Barbell Squat',
    });
    expect(openOverlay).toHaveBeenNthCalledWith(2, {
      screen: 'exercise-history',
      name: 'Barbell Squat',
    });
  });

  it('editing hosts get the exercise picker; read-only hosts get the trainer day tag instead', () => {
    const edit = host();
    expect(edit.slots?.exercisePicker).toBe(SelfExercisePicker);
    expect(edit.slots?.dayTag).toBeUndefined();
    expect(edit.slots?.muscleMap).toBeTruthy();
    const ro = host({ readOnly: true });
    expect(ro.slots?.exercisePicker).toBeUndefined();
    const Tag = ro.slots!.dayTag!;
    render(<Tag day={3} />);
    expect(screen.getByTestId('daytag').textContent).toBe('3');
  });

  it.each<[LocaleId, string]>([
    ['en', 'You pick sets, reps and weight in the session'],
    ['uk', 'Підходи, повторення і вагу ви обираєте'],
    ['pl', 'Serie, powtórzenia i ciężar wybierasz'],
    ['lt', 'Serijas, pakartojimus ir svorį pasirenkate'],
    ['et', 'Seeriad, kordused ja raskuse valid'],
  ])('the "just the exercise" text is the athlete\'s own words in %s', (loc, start) => {
    setLocale(loc);
    const h = host();
    expect((h.labels.edBareBody as () => string)().startsWith(start)).toBe(true);
  });
});

describe('SelfExercisePicker', () => {
  beforeEach(() => setDesktop(false));
  const cbs = () => ({
    dayLabel: 'Upper A',
    taken: ['Barbell Bench Press'],
    onPick: vi.fn(),
    onCreate: vi.fn(),
    onMarker: vi.fn(),
    onCardio: vi.fn(),
    onClose: vi.fn(),
  });

  it('is the plain program picker titled for the day', () => {
    render(<SelfExercisePicker {...cbs()} />);
    expect(screen.getAllByText(/Upper A/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: en.exerciseKindNames.warmup })).toBeTruthy();
  });

  it('the warm-up and cool-down buttons add markers', () => {
    const p = cbs();
    render(<SelfExercisePicker {...p} />);
    fireEvent.click(screen.getByRole('button', { name: en.exerciseKindNames.warmup }));
    fireEvent.click(screen.getByRole('button', { name: en.exerciseKindNames.cooldown }));
    expect(p.onMarker.mock.calls).toEqual([['warmup'], ['cooldown']]);
  });

  it('Cardio opens the machine list; picking a machine reports its name', () => {
    const p = cbs();
    render(<SelfExercisePicker {...p} />);
    fireEvent.click(screen.getByRole('button', { name: en.exerciseKindNames.cardio }));
    expect(document.body.textContent).toContain(en.cardioMachineTitle);
    fireEvent.click(screen.getByText(en.cardioNoMachine));
    expect(p.onCardio).toHaveBeenCalledWith(en.defaultTimedExerciseNames.cardio);
  });

  it('closing the machine list closes the picker', async () => {
    const p = cbs();
    render(<SelfExercisePicker {...p} />);
    fireEvent.click(screen.getByRole('button', { name: en.exerciseKindNames.cardio }));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(p.onClose).toHaveBeenCalled());
  });

  it('searching and pressing Enter picks the top hit; an unknown name is created', () => {
    const p = cbs();
    render(<SelfExercisePicker {...p} />);
    const input = screen.getAllByPlaceholderText(en.pickSearch)[0] as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'barbell squat' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(p.onPick).toHaveBeenCalledTimes(1);
    expect(p.onPick.mock.calls[0][0].toLowerCase()).toContain('squat');
    fireEvent.change(input, { target: { value: 'qqq zzz custom lift' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(p.onCreate).toHaveBeenCalledWith('qqq zzz custom lift');
  });
});
