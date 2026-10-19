import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { LOCALES, setLocale } from '../i18n';
import { __getStateForTests, __replaceStateForTests } from '../store';
import { BUILT_IN_CATALOG } from '../data/exercises';
import type { Workout } from '../types';
import { MuscleBreakdownList, MuscleRow } from './Muscle';

const en = () => LOCALES.en;
const NOW = new Date(2026, 8, 15, 12, 0).getTime(); // Tue 15 Sep 2026
const benchName = BUILT_IN_CATALOG.find(
  (c) => c.muscle === 'chest' && /bench press/i.test(c.names[0]),
)!.names[0];
const wk = (id: string, startedAt: number, name: string, sets: number): Workout => ({
  id,
  startedAt,
  finishedAt: startedAt + 3600000,
  autoFinished: false,
  exercises: [
    {
      id: `${id}e`,
      name,
      position: 0,
      sets: Array.from({ length: sets }, (_, i) => ({
        id: `${id}s${i}`,
        reps: 8,
        weight: 60,
        isWarmup: false,
      })),
    } as never,
  ],
});
const setWorkouts = (workouts: Workout[]) =>
  __replaceStateForTests({ ...__getStateForTests(), workouts } as never);

beforeEach(() => {
  setLocale('en');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  setWorkouts([]);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('MuscleBreakdownList', () => {
  const monday = new Date(2026, 8, 14, 9, 0).getTime();
  const tuesday = new Date(2026, 8, 15, 9, 0).getTime();

  it('lists each muscle with its session sets, primary first styling and a volume meter', () => {
    render(
      <MuscleBreakdownList
        refTs={tuesday}
        entries={[
          { muscle: 'chest', sets: 3, primary: true },
          { muscle: 'triceps', sets: 1.5, primary: false },
        ]}
      />,
    );
    const rows = [...document.querySelectorAll('.md-row')];
    expect(rows).toHaveLength(2);
    expect(rows[0].classList.contains('primary')).toBe(true);
    expect(rows[1].classList.contains('primary')).toBe(false);
    expect(rows[0].querySelector('.md-name')!.textContent).toBe(en().muscleGroups.chest);
    expect(rows[0].querySelector('.md-count')!.textContent).toBe('3');
    expect(rows[1].querySelector('.md-count')!.textContent).toBe('1.5');
    expect(rows[0].querySelector('.md-meter-lab')!.textContent).toMatch(/^3 \/ \d+(\.\d)?$/);
    expect(rows[0].querySelector('.md-week-tag')!.textContent).toBe(en().mdWeekTag);
    const fill = rows[0].querySelector('.md-bar-fill') as HTMLElement;
    expect(parseFloat(fill.style.width)).toBeGreaterThan(0);
    expect(parseFloat(fill.style.width)).toBeLessThanOrEqual(100);
  });

  it('adds the rest of the same week (up to the viewed session) to the weekly figure', () => {
    setWorkouts([
      wk('mon', monday, benchName, 4), // earlier this week: counts
      wk('later', new Date(2026, 8, 16, 9, 0).getTime(), benchName, 6), // after the viewed session: must not count
      wk('last', new Date(2026, 8, 7, 9, 0).getTime(), benchName, 5), // last week: must not count
    ]);
    render(
      <MuscleBreakdownList
        refTs={tuesday}
        entries={[{ muscle: 'chest', sets: 3, primary: true }]}
      />,
    );
    const lab = document.querySelector('.md-meter-lab')!.textContent!;
    const shown = parseFloat(lab);
    expect(shown).toBeGreaterThan(3); // 3 today + Monday's sets
    expect(shown).toBeLessThan(3 + 4 + 6); // not the later session
    expect(document.querySelector('.md-count')!.textContent).toBe('3'); // the right-hand count stays this session
  });

  it('showWeek=false hides the meters and counts', () => {
    render(
      <MuscleBreakdownList
        refTs={tuesday}
        showWeek={false}
        entries={[{ muscle: 'chest', sets: 3, primary: true }]}
      />,
    );
    expect(document.querySelector('.md-meter')).toBeNull();
    expect(document.querySelector('.md-count')).toBeNull();
    expect(screen.getByText(en().muscleGroups.chest)).toBeTruthy();
  });

  it('entries are buttons only when onOpen is given', () => {
    const onOpen = vi.fn();
    const a = render(
      <MuscleBreakdownList
        refTs={tuesday}
        entries={[{ muscle: 'lats', sets: 2, primary: true }]}
      />,
    );
    expect(a.container.querySelector('[role=button]')).toBeNull();
    a.unmount();
    render(
      <MuscleBreakdownList
        refTs={tuesday}
        onOpen={onOpen}
        entries={[{ muscle: 'lats', sets: 2, primary: true }]}
      />,
    );
    const row = document.querySelector('.md-row') as HTMLElement;
    expect(row.getAttribute('role')).toBe('button');
    expect(row.tabIndex).toBe(0);
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledWith('lats');
  });

  it('a muscle without a volume landmark shows no bar, only the week tag when it spans several sessions', () => {
    setWorkouts([wk('mon', monday, benchName, 2)]);
    render(
      <MuscleBreakdownList
        refTs={tuesday}
        entries={[
          { muscle: 'fullbody', sets: 1, primary: true },
          { muscle: 'neck', sets: 1, primary: false },
        ]}
      />,
    );
    const rows = [...document.querySelectorAll('.md-row')];
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.querySelector('.md-name')!.textContent).toBeTruthy();
  });
});

describe('MuscleRow', () => {
  const entries = [
    { muscle: 'chest' as const, sets: 3, primary: true },
    { muscle: 'triceps' as const, sets: 2, primary: true },
    { muscle: 'shoulders' as const, sets: 1, primary: false },
    { muscle: 'core' as const, sets: 1, primary: false },
  ];
  const tuesday = new Date(2026, 8, 15, 9, 0).getTime();
  let roCallbacks: Array<() => void> = [];
  let roDisconnects = 0;

  beforeEach(() => {
    roCallbacks = [];
    roDisconnects = 0;
    window.ResizeObserver = class {
      constructor(cb: () => void) {
        roCallbacks.push(cb);
      }
      observe() {}
      unobserve() {}
      disconnect() {
        roDisconnects++;
      }
    } as never;
  });

  /** jsdom has no layout: model each visible chip as 100px in a 250px row. */
  function fakeLayout(width: { value: number }) {
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get(this: HTMLElement) {
        if (!this.classList.contains('mrow')) return 0;
        const chips = [...this.querySelectorAll<HTMLElement>('[data-mchip]')].filter(
          (c) => c.style.display !== 'none',
        );
        return chips.length * 100;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains('mrow') ? width.value : 0;
      },
    });
  }
  afterEach(() => {
    // @ts-expect-error restore jsdom defaults
    delete HTMLElement.prototype.scrollWidth;
    // @ts-expect-error restore jsdom defaults
    delete HTMLElement.prototype.clientWidth;
  });

  it('renders nothing for no entries', () => {
    const { container } = render(<MuscleRow entries={[]} refTs={tuesday} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows every chip and hides "+N more" when the row fits', () => {
    render(<MuscleRow entries={entries} refTs={tuesday} />);
    expect(document.querySelectorAll('[data-mchip]')).toHaveLength(4);
    expect((document.querySelector('.mrow-more') as HTMLElement).style.display).toBe('none');
  });

  it('drops chips from the end until the row fits and reports how many are hidden', () => {
    fakeLayout({ value: 250 });
    render(<MuscleRow entries={entries} refTs={tuesday} />);
    const chips = [...document.querySelectorAll<HTMLElement>('[data-mchip]')];
    expect(chips.map((c) => c.style.display)).toEqual(['', '', 'none', 'none']);
    const more = document.querySelector('.mrow-more') as HTMLElement;
    expect(more.style.display).toBe('');
    expect(more.querySelector('.n')!.textContent).toBe('2');
    expect(more.textContent).toContain(en().moreLabel);
  });

  it('re-fits when the row is resized, and stops observing on unmount', () => {
    const width = { value: 250 };
    fakeLayout(width);
    const { unmount } = render(<MuscleRow entries={entries} refTs={tuesday} />);
    width.value = 500;
    act(() => roCallbacks.forEach((cb) => cb()));
    expect(
      [...document.querySelectorAll<HTMLElement>('[data-mchip]')].every(
        (c) => c.style.display === '',
      ),
    ).toBe(true);
    expect((document.querySelector('.mrow-more') as HTMLElement).style.display).toBe('none');
    unmount();
    expect(roDisconnects).toBeGreaterThan(0);
  });

  it('works without ResizeObserver', () => {
    // @ts-expect-error old browser
    window.ResizeObserver = undefined;
    render(<MuscleRow entries={entries} refTs={tuesday} />);
    expect(document.querySelectorAll('[data-mchip]')).toHaveLength(4);
  });

  it('"+N more" opens the full breakdown drawer by click and by Enter / Space, without reaching the row', () => {
    fakeLayout({ value: 250 });
    const outer = vi.fn();
    render(
      <div onClick={outer}>
        <MuscleRow entries={entries} refTs={tuesday} />
      </div>,
    );
    const more = document.querySelector('.mrow-more') as HTMLElement;
    fireEvent.click(more);
    expect(outer).not.toHaveBeenCalled();
    const drawer = () => document.querySelector('.muscle-drawer') as HTMLElement;
    expect(within(drawer()).getByText(en().musclesWorkedLabel)).toBeTruthy();
    expect(drawer().querySelectorAll('.md-row')).toHaveLength(4);
    fireEvent.click(drawer());
    expect(outer).not.toHaveBeenCalled();
    cleanup();
    render(<MuscleRow entries={entries} refTs={tuesday} showWeek={false} />);
    fireEvent.keyDown(document.querySelector('.mrow-more') as HTMLElement, { key: 'Enter' });
    expect(drawer().querySelector('.md-meter')).toBeNull();
    cleanup();
    render(<MuscleRow entries={entries} refTs={tuesday} />);
    fireEvent.keyDown(document.querySelector('.mrow-more') as HTMLElement, { key: ' ' });
    expect(drawer()).toBeTruthy();
    cleanup();
    render(<MuscleRow entries={entries} refTs={tuesday} />);
    fireEvent.keyDown(document.querySelector('.mrow-more') as HTMLElement, { key: 'a' });
    expect(document.querySelector('.muscle-drawer')).toBeNull();
  });

  it('a chip tap opens its enlarged drawer and does not bubble to the row', () => {
    const outer = vi.fn();
    const onOpen = vi.fn();
    render(
      <div onClick={outer}>
        <MuscleRow entries={entries} refTs={tuesday} onOpen={onOpen} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en().muscleGroups.chest) }));
    expect(outer).not.toHaveBeenCalled();
    const info = document.querySelector('.muscle-info') as HTMLElement;
    fireEvent.click(
      within(info).getByRole('button', { name: en().muscleHistoryTitle(en().muscleGroups.chest) }),
    );
    expect(onOpen).toHaveBeenCalledWith('chest');
  });

  it('draws a readiness dot only for muscles that have one', () => {
    render(<MuscleRow entries={entries} refTs={tuesday} dots={{ chest: 'rgb(9, 9, 9)' }} />);
    const dots = document.querySelectorAll('.mrow-dot');
    expect(dots).toHaveLength(1);
    expect((dots[0] as HTMLElement).style.background).toBe('rgb(9, 9, 9)');
    expect(dots[0].closest('[data-mchip]')!.textContent).toContain(en().muscleGroups.chest);
  });
});
