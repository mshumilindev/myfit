import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  fitCount,
  fitLayout,
  splitEntries,
  type RailEntry,
  type RailFootEntry,
} from './railOverflow';
import { Rail } from './Rail';
import { MoreMenu } from './MoreMenu';
import { AccountPopover } from './AccountPopover';
import { installRailMeasure, setRailHeight, uninstallRailMeasure } from './railTestUtils';

afterEach(cleanup);

describe('fitCount (labelled 64 tile, pitch 69.6; compact 44, pitch 49.6)', () => {
  it('everything fits -> n, no More', () => {
    expect(fitCount(482, 7, 64)).toBe(7); // 7*69.6-5.6 = 481.6
    expect(fitCount(1000, 7, 64)).toBe(7);
    expect(fitCount(342, 7, 44)).toBe(7); // 7*49.6-5.6 = 341.6
  });
  it('one px short: More takes a pitch, k tiles fit in the rest', () => {
    expect(fitCount(481, 7, 64)).toBe(5);
    expect(fitCount(300, 7, 64)).toBe(3);
    expect(fitCount(200, 7, 64)).toBe(1);
    expect(fitCount(341, 7, 44)).toBe(5);
    expect(fitCount(200, 7, 44)).toBe(3);
  });
  it('never negative, never n when it overflows', () => {
    expect(fitCount(30, 7, 64)).toBe(0);
    expect(fitCount(130, 2, 64)).toBe(0);
    expect(fitCount(140, 2, 64)).toBe(2);
  });
  it('not measured (0) shows everything', () => {
    expect(fitCount(0, 7, 64)).toBe(7);
  });
});

describe('splitEntries', () => {
  const e = (id: string, priority?: number) => ({ id, priority });
  it('default: collapses from the end, both lists keep original order', () => {
    const r = splitEntries([e('a'), e('b'), e('c'), e('d')], 2);
    expect(r.visible.map((x) => x.id)).toEqual(['a', 'b']);
    expect(r.hidden.map((x) => x.id)).toEqual(['c', 'd']);
  });
  it('priority: higher collapses first, regardless of position', () => {
    const r = splitEntries([e('a'), e('b', 99), e('c'), e('d')], 3);
    expect(r.hidden.map((x) => x.id)).toEqual(['b']);
    expect(r.visible.map((x) => x.id)).toEqual(['a', 'c', 'd']);
  });
  it('all visible -> nothing hidden', () => {
    expect(splitEntries([e('a'), e('b')], 5).hidden).toEqual([]);
  });
});

describe('Rail overflow (generic)', () => {
  beforeEach(() => installRailMeasure(1000));
  afterEach(uninstallRailMeasure);
  const mk = (n: number): RailEntry[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `e${i}`,
      label: `Item ${i}`,
      icon: 'house',
      onSelect: vi.fn(),
    }));
  const rail = (entries: RailEntry[]) => (
    <Rail
      brand={<span />}
      overflow={{
        entries,
        moreLabel: 'More',
        renderMenu: ({ hidden, open, onClose, anchorRef }) => (
          <MoreMenu
            presentation="popover"
            open={open}
            onClose={onClose}
            anchorRef={anchorRef}
            title="More"
            items={hidden}
          />
        ),
      }}
    />
  );
  const names = () =>
    [...document.querySelectorAll('.rail-nav > .rail-item')].map((b) =>
      b.getAttribute('aria-label'),
    );

  it('a default rail (no overflow) keeps its markup: no .rail-nav wrapper', () => {
    const { container } = render(<Rail brand={<span />}>{null}</Rail>);
    expect(container.querySelector('.rail-nav')).toBeNull();
  });

  it('no More when it fits; More when not; priority picks what collapses', () => {
    // default rail: tile 46, gap 5.6, 5 tiles = 5*51.6-5.6 = 252.4.
    setRailHeight(253);
    const entries = mk(5);
    entries[1] = { ...entries[1], priority: 100 };
    const { rerender } = render(rail(entries));
    expect(names()).toEqual(['Item 0', 'Item 1', 'Item 2', 'Item 3', 'Item 4']);
    setRailHeight(200);
    rerender(rail(entries));
    // k = floor((200-46)/51.6) = 2 stay; Item 1 (priority 100) went first. More is in the foot.
    expect(names()).toEqual(['Item 0', 'Item 2']);
    expect(document.querySelector('.rail-nav > .rail-more')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('button', { name: 'Item 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Item 4' })).toBeTruthy();
  });

  it('a live entry shows its dot and speaks its live label', () => {
    setRailHeight(1000);
    const entries = mk(2);
    entries[0] = { ...entries[0], live: true, liveLabel: 'session in progress' };
    render(rail(entries));
    const first = document.querySelector('.rail-nav > .rail-item') as HTMLElement;
    expect(first.querySelector('.rail-live-dot')).not.toBeNull();
    expect(first.getAttribute('aria-label')).toBe('Item 0, session in progress');
    expect(document.querySelectorAll('.rail-live-dot')).toHaveLength(1);
  });

  it('closes the menu by itself when More disappears', () => {
    setRailHeight(100);
    render(rail(mk(5)));
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('dialog', { name: 'More' })).toBeTruthy();
    setRailHeight(1000);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
  });
});

describe('AccountPopover', () => {
  it('shows only the account block and closes on a mode change / Profile', () => {
    const onClose = vi.fn();
    const onMode = vi.fn();
    const onProfile = vi.fn();
    render(
      <AccountPopover<'a' | 'b'>
        open
        onClose={onClose}
        anchorRef={{ current: document.body }}
        title="Account"
        account={{
          name: 'Iryna Koval',
          roleLabel: 'Trainer',
          modes: [
            { value: 'a', label: 'Coach' },
            { value: 'b', label: 'Mine' },
          ],
          mode: 'a',
          onModeChange: onMode,
          profile: { label: 'Profile', onOpen: onProfile },
        }}
      />,
    );
    const dlg = screen.getByRole('dialog', { name: 'Account' });
    expect(dlg.textContent).toContain('Iryna Koval');
    fireEvent.click(screen.getByRole('button', { name: 'Mine' }));
    fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
    expect(onMode).toHaveBeenCalledWith('b');
    expect(onProfile).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('fitLayout (foot extras collapse before nav entries)', () => {
  // labelled: nav tile 64 (pitch 69.6), extra tile 44 (pitch 49.6)
  it('everything fits -> all nav, all extras', () => {
    expect(fitLayout(401.6, 3, 64, 4, 44)).toEqual({ nav: 3, extras: 4 });
    expect(fitLayout(0, 3, 64, 4, 44)).toEqual({ nav: 3, extras: 4 });
  });
  it('short: the extras group hides ALL AT ONCE (never one by one), the nav stays whole', () => {
    // 401.6 fits everything; one px less and not one extra stays (it used to leave 3, 2, 1...)
    for (const room of [401, 380, 330, 290, 273])
      expect(fitLayout(room, 3, 64, 4, 44)).toEqual({ nav: 3, extras: 0 });
    // More takes a pitch: nav (203.2) + More (69.6) = 272.8 still fits the whole nav
    expect(fitLayout(272.8, 3, 64, 4, 44)).toEqual({ nav: 3, extras: 0 });
  });
  it('only with no extras left do nav entries collapse, never to n', () => {
    expect(fitLayout(250, 3, 64, 4, 44)).toEqual({ nav: 2, extras: 0 });
    expect(fitLayout(100, 3, 64, 4, 44)).toEqual({ nav: 0, extras: 0 });
  });
  it('no extras behaves like fitCount', () => {
    for (const room of [481, 300, 200, 130, 30])
      expect(fitLayout(room, 7, 64, 0, 44).nav).toBe(fitCount(room, 7, 64));
  });
});

describe('Rail footEntries (generic)', () => {
  beforeEach(() => installRailMeasure(1000));
  afterEach(uninstallRailMeasure);
  const nav: RailEntry[] = [0, 1, 2].map((i) => ({
    id: `n${i}`,
    label: `Nav ${i}`,
    icon: 'house',
    onSelect: vi.fn(),
  }));
  const foot: RailFootEntry[] = [
    { id: 'a', label: 'Alpha', icon: 'bell', onSelect: vi.fn(), count: 4, countLabel: '4 unread' },
    { id: 'b', label: 'Beta', icon: 'gear', onSelect: vi.fn() },
  ];
  const rail = () => (
    <Rail
      brand={<span />}
      foot={<button aria-label="Pinned">p</button>}
      overflow={{
        entries: nav,
        footEntries: foot,
        moreLabel: 'More',
        moreCountLabel: (n) => `${n} unread`,
        renderMenu: ({ hiddenNav, hiddenFoot, open, onClose, anchorRef }) => (
          <MoreMenu
            presentation="popover"
            open={open}
            onClose={onClose}
            anchorRef={anchorRef}
            title="More"
            items={hiddenNav}
            extraItems={hiddenFoot}
          />
        ),
      }}
    />
  );
  it('hides the whole extras group at once, then nav from the end; the pinned foot stays last', () => {
    render(rail());
    // default rail: nav tile 46 (pitch 51.6, 3 = 149.2), extras 46 (51.6 each)
    setRailHeight(300);
    expect(document.querySelectorAll('.rail-extra')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
    setRailHeight(240); // More + nav (149.2) + one extra (51.6) = 252.4 > 240
    expect(document.querySelectorAll('.rail-extra')).toHaveLength(0);
    expect(document.querySelectorAll('.rail-nav > .rail-item')).toHaveLength(3);
    const more = screen.getByRole('button', { name: 'More, 4 unread' });
    fireEvent.click(more);
    const dlg = screen.getByRole('dialog', { name: 'More' });
    expect([...dlg.querySelectorAll('button.uirow')].map((b) => b.textContent)).toEqual([
      'Alpha4',
      'Beta',
    ]);
    setRailHeight(120);
    expect(document.querySelectorAll('.rail-nav > .rail-item')).toHaveLength(1);
    const names = [...document.querySelectorAll('.rail-foot > *')].map(
      (e) => e.getAttribute('aria-label') ?? e.querySelector('button')?.getAttribute('aria-label'),
    );
    expect(names[names.length - 1]).toBe('Pinned');
  });
});
