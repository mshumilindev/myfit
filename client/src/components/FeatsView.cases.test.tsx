import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { setLocale } from '../i18n';
import { CATEGORIES, type Ach, type FeatGroup, type FeatsResult } from '../feats';
import type { Workout } from '../types';

let result: FeatsResult;
vi.mock('../feats', async (orig) => ({
  ...(await orig<typeof import('../feats')>()),
  computeFeats: () => result,
}));
vi.mock('./StandardsView', () => ({
  StandardsView: () => <div data-testid="standards" />,
}));

import { FeatsView } from './FeatsView';

const ach = (group: FeatGroup, i: number, unlocked: boolean, over: Partial<Ach> = {}): Ach => ({
  key: `${group}-${i}`,
  group,
  emoji: '🏋️',
  title: `${group} ${i}`,
  threshold: (i + 1) * 1000,
  unit: 'kg',
  value: unlocked ? (i + 1) * 1000 : 400,
  prev: i * 1000,
  unlocked,
  progress: unlocked ? 1 : 0.4,
  ...over,
});
function build(ladders: Partial<Record<FeatGroup, boolean[]>>, nextUp: Ach | null = null) {
  const byGroup = {} as Record<FeatGroup, Ach[]>;
  for (const c of CATEGORIES)
    byGroup[c.group] = (ladders[c.group] ?? []).map((u, i) => ach(c.group, i, u));
  const all = Object.values(byGroup).flat();
  return {
    byGroup,
    nextUp,
    unlockedCount: all.filter((a) => a.unlocked).length,
    total: all.length,
  } as FeatsResult;
}

const W = { id: 'w' } as Workout;
const props = {
  finished: [W],
  body: { weights: [] },
  sub: 'achievements' as const,
  onSub: () => undefined,
};

let roCb: ((e: Array<{ contentRect: { width: number } }>) => void) | null = null;
let roDisconnect = vi.fn();
beforeEach(() => {
  setLocale('en');
  roCb = null;
  roDisconnect = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: typeof roCb) {
        roCb = cb;
      }
      observe() {}
      disconnect = roDisconnect;
    },
  );
  result = build({ volume: [true, true, false, false, false] });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const volumeSection = () => document.querySelector('.feats-section') as HTMLElement;

describe('FeatsView', () => {
  it('shows the empty state without any finished workout', () => {
    render(<FeatsView {...props} finished={[]} />);
    expect(screen.getByText('No feats yet')).toBeTruthy();
  });

  it('shows the totals, the next milestone with a progress bar and what is left', () => {
    result = build(
      { volume: [true, false] },
      ach('volume', 1, false, {
        value: 1500,
        threshold: 2000,
        progress: 0.75,
        emoji: '🔥',
        title: 'Big',
      }),
    );
    render(<FeatsView {...props} />);
    expect(document.querySelector('.feats-count')!.textContent).toBe('1 of 2');
    expect(document.querySelector('.fn-name')!.textContent).toBe('Big');
    expect((document.querySelector('.fn-fill') as HTMLElement).style.width).toBe('75%');
    expect(document.querySelector('.fn-foot')!.textContent).toContain('1.5 t');
    expect(document.querySelector('.fn-foot')!.textContent).toContain('500 kg to go');
  });

  it('omits the next milestone when there is none', () => {
    render(<FeatsView {...props} />);
    expect(document.querySelector('.feats-nextup')).toBeNull();
  });

  it('lays out an earned block, the current tile with progress, and the rest as tiles', () => {
    render(<FeatsView {...props} />);
    const sec = volumeSection();
    expect(sec.querySelector('.feat-block .fb-num')!.textContent).toBe('2');
    expect(sec.querySelector('.feat-block .fb-lab')!.textContent).toBe('Earned');
    const tiles = sec.querySelectorAll('.feat-cell');
    expect(tiles).toHaveLength(3);
    expect(tiles[0].querySelector('.feat-prog')).toBeTruthy();
    expect(tiles[1].querySelector('.feat-prog')).toBeNull();
    expect(sec.querySelector('.fs-count')!.textContent).toBe('2/5');
    // no upcoming block: everything fits in 6 columns
    expect(sec.querySelectorAll('.feat-block')).toHaveLength(1);
  });

  it('collapses far-future tiers into a "+N upcoming" block when columns are scarce', () => {
    result = build({ volume: [true, ...Array(10).fill(false)] });
    render(<FeatsView {...props} />);
    // 6 cols: 1 prev + 4 middle + 1 upcoming block (+6)
    const blocks = volumeSection().querySelectorAll('.feat-block');
    expect(blocks).toHaveLength(2);
    expect(blocks[1].querySelector('.fb-num')!.textContent).toBe('+6');
    expect(volumeSection().querySelectorAll('.feat-cell')).toHaveLength(4);
  });

  it('labels the earned block "All earned" when the whole ladder is done', () => {
    result = build({ volume: [true, true, true] });
    render(<FeatsView {...props} />);
    expect(volumeSection().querySelector('.fb-lab')!.textContent).toBe('All earned');
    expect(volumeSection().querySelectorAll('.feat-cell')).toHaveLength(0);
  });

  it('has no earned block when nothing is unlocked yet', () => {
    result = build({ volume: [false, false] });
    render(<FeatsView {...props} />);
    expect(volumeSection().querySelectorAll('.feat-block')).toHaveLength(0);
    expect(volumeSection().querySelectorAll('.feat-cell')).toHaveLength(2);
  });

  it('resizes the grid with the container (min 3 columns)', () => {
    render(<FeatsView {...props} />);
    const row = () => document.querySelector('.feats-row') as HTMLElement;
    // jsdom clientWidth is 0 -> default 6
    expect(row().style.gridTemplateColumns).toBe('repeat(6, 1fr)');
    // floor((100+12)/162)=0 -> min 3
    act(() => roCb!([{ contentRect: { width: 100 } }]));
    expect(row().style.gridTemplateColumns).toBe('repeat(3, 1fr)');
  });

  it('caps columns at 11 and disconnects the observer on unmount', () => {
    const { unmount } = render(<FeatsView {...props} />);
    act(() => roCb!([{ contentRect: { width: 5000 } }]));
    expect((document.querySelector('.feats-row') as HTMLElement).style.gridTemplateColumns).toBe(
      'repeat(11, 1fr)',
    );
    unmount();
    expect(roDisconnect).toHaveBeenCalled();
  });

  it('works without ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    render(<FeatsView {...props} />);
    expect((document.querySelector('.feats-row') as HTMLElement).style.gridTemplateColumns).toBe(
      'repeat(6, 1fr)',
    );
  });

  it('opens the earned list popup, opens a feat on top of it, and closes in two steps', () => {
    result = build({ volume: [true, true, false, false] });
    render(<FeatsView {...props} />);
    fireEvent.click(volumeSection().querySelector('.feat-block')!);
    const pop = document.querySelector('.feat-listpop') as HTMLElement;
    expect(pop.querySelector('.flp-title')!.textContent).toBe('Volume lifted · Earned');
    expect(pop.querySelector('.flp-count')!.textContent).toBe('2');
    expect(pop.querySelectorAll('.flp-grid .feat-cell')).toHaveLength(2);
    fireEvent.click(pop.querySelector('.flp-grid .feat-cell')!);
    const detail = document.querySelector('.feat-detail') as HTMLElement;
    expect(detail).toBeTruthy();
    fireEvent.click(within(detail).getByRole('button', { name: 'Close' }));
    expect(document.querySelector('.feat-detail')).toBeNull();
    expect(document.querySelector('.feat-listpop')).toBeTruthy();
    fireEvent.click(within(pop).getByRole('button', { name: 'Close' }));
    expect(document.querySelector('.feat-listpop')).toBeNull();
  });

  it('closes the popup by clicking its scrim but not its body', () => {
    render(<FeatsView {...props} />);
    fireEvent.click(volumeSection().querySelector('.feat-block')!);
    fireEvent.click(document.querySelector('.feat-listpop')!);
    expect(document.querySelector('.feat-listpop')).toBeTruthy();
    fireEvent.click(document.querySelector('.feat-scrim')!);
    expect(document.querySelector('.feat-listpop')).toBeNull();
  });

  it('the upcoming popup lists exactly the tiers that did not fit inline', () => {
    result = build({ volume: [true, ...Array(10).fill(false)] });
    render(<FeatsView {...props} />);
    fireEvent.click(volumeSection().querySelectorAll('.feat-block')[1]);
    const pop = document.querySelector('.feat-listpop') as HTMLElement;
    expect(pop.querySelector('.flp-title')!.textContent).toBe('Volume lifted · Upcoming');
    expect(pop.querySelectorAll('.feat-cell')).toHaveLength(6);
    expect(pop.querySelector('.feat-name')!.textContent).toBe('volume 5');
  });

  it('the earned popup shows the whole ladder when all are unlocked', () => {
    result = build({ volume: [true, true, true] });
    render(<FeatsView {...props} />);
    fireEvent.click(volumeSection().querySelector('.feat-block')!);
    expect(document.querySelectorAll('.flp-grid .feat-cell')).toHaveLength(3);
  });

  it('shows a locked feat detail with what is left, and an unlocked one with its date', () => {
    result = build({ volume: [true, false] });
    result.byGroup.volume[0].unlockAt = Date.UTC(2026, 2, 5, 12);
    render(<FeatsView {...props} />);
    const cells = volumeSection().querySelectorAll('.feat-cell');
    fireEvent.click(cells[0]);
    let d = document.querySelector('.feat-detail') as HTMLElement;
    expect(d.querySelector('.fd-name')!.textContent).toBe('volume 1');
    expect(d.textContent).toContain('1.6 t to go');
    const rows = [...d.querySelectorAll('.fd-row b')].map((b) => b.textContent);
    expect(rows).toEqual(['400 kg', '2.0 t']);
    // closing via the scrim
    fireEvent.click(document.querySelector('.feat-scrim-top')!);
    expect(document.querySelector('.feat-detail')).toBeNull();
    // unlocked via the earned popup
    fireEvent.click(volumeSection().querySelector('.feat-block')!);
    fireEvent.click(document.querySelector('.flp-grid .feat-cell')!);
    d = document.querySelector('.feat-detail') as HTMLElement;
    expect(d.textContent).toMatch(/Unlocked .*Mar/);
  });

  it('an unlocked feat without a date shows no unlock tag', () => {
    result = build({ volume: [true, false] });
    render(<FeatsView {...props} />);
    fireEvent.click(volumeSection().querySelector('.feat-block')!);
    fireEvent.click(document.querySelector('.flp-grid .feat-cell')!);
    expect(document.querySelector('.feat-detail')!.textContent).not.toMatch(/Unlocked|to go/);
  });

  it('shows the explanation line only for groups that have one', () => {
    render(<FeatsView {...props} />);
    fireEvent.click(volumeSection().querySelector('.feat-cell')!);
    expect(document.querySelector('.fd-explain')!.textContent).toMatch(/Total weight moved/);
  });

  it('toggles the sub tabs and reports the choice', () => {
    const onSub = vi.fn();
    render(<FeatsView {...props} onSub={onSub} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Standards' }));
    expect(onSub).toHaveBeenCalledWith('standards');
  });

  it('renders the standards sub tab', () => {
    render(<FeatsView {...props} sub="standards" />);
    expect(screen.getByTestId('standards')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Achievements' })).toBeTruthy();
  });

  it('hides the sub tabs (and ignores "standards") when hideSubtabs is set', () => {
    render(<FeatsView {...props} sub="standards" hideSubtabs />);
    expect(screen.queryByTestId('standards')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(document.querySelector('.feats')).toBeTruthy();
  });
});
