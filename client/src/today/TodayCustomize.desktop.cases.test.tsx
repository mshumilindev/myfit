import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { TodayCustomize } from './TodayCustomize';
import {
  CORE_IDS,
  DEFAULT_LAYOUT,
  addSection,
  getTodayLayout,
  insertWidget,
  setTodayLayout,
  type CoreId,
  type CustomSection,
  type TodayLayout,
} from './layout';
import { useTw } from './strings';
import type { ShortcutCtx } from './shortcuts';
import { setLocale, useT } from '../i18n';
import {
  NOW,
  activities,
  emptyState,
  makeShell,
  richState,
  seed,
} from './__fixtures__/widgetHarness';
import { __getStateForTests } from '../store';

const shell = makeShell();

function Harness({
  side,
  onClose,
  hasClients = false,
  coreFor,
}: {
  side: HTMLElement | null;
  onClose: () => void;
  hasClients?: boolean;
  coreFor?: (l: TodayLayout) => Record<CoreId, React.ReactNode>;
}) {
  const { t, locale } = useT();
  const tw = useTw();
  const ctx: ShortcutCtx = {
    store: __getStateForTests(),
    now: NOW,
    t,
    tw,
    locale,
    shell,
    openWeight: () => undefined,
    startToday: null,
    logPast: () => undefined,
  };
  const core =
    coreFor ??
    ((l: TodayLayout) =>
      Object.fromEntries(
        CORE_IDS.map((id) => [
          id,
          <div key={id}>{`${id}:${JSON.stringify(l.sections.find((s) => s.id === id))}`}</div>,
        ]),
      ) as Record<CoreId, React.ReactNode>);
  return (
    <TodayCustomize
      coreFor={core}
      hasClients={hasClients}
      ctx={ctx}
      side={side}
      onClose={onClose}
    />
  );
}

const custom = (id: string) =>
  getTodayLayout().sections.find((s) => s.id === id) as CustomSection | undefined;
const ids = () => getTodayLayout().sections.map((s) => s.id);
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  localStorage.clear();
  setLocale('en');
  seed(richState());
  setTodayLayout(DEFAULT_LAYOUT);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Customize Today — desktop panel', () => {
  let side: HTMLElement;
  beforeEach(() => {
    side = document.createElement('aside');
    document.body.appendChild(side);
  });
  afterEach(() => side.remove());
  const tab = (name: string) =>
    fireEvent.click(
      within(side.querySelector('.uiseg') as HTMLElement).getByRole('button', { name }),
    );
  const pairSection = () =>
    setTodayLayout(addSection(DEFAULT_LAYOUT, { id: 'mine', title: 'Mine', layout: 'pair' }));

  it('the Sections tab lists every layout and a click adds it before History', () => {
    render(<Harness side={side} onClose={() => undefined} />);
    const grid = side.querySelector('.tdc-ap-layouts') as HTMLElement;
    expect(
      within(grid)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Shortcuts', 'Pair', 'Quad', 'Rows', 'Wide', 'Wide + pair', 'Big']);
    fireEvent.click(within(grid).getByRole('button', { name: 'Rows' }));
    save();
    expect(ids()[ids().length - 2]).toMatch(/^sec/);
    expect((getTodayLayout().sections[ids().length - 2] as CustomSection).layout).toBe('rows');
  });

  it('widgets: search by name or group, group chips, "Nothing found", click adds into the first section with room', () => {
    pairSection();
    render(<Harness side={side} onClose={() => undefined} />);
    tab('Widgets');
    const all = side.querySelectorAll('.tdc-pick[role="button"]').length;
    expect(all).toBeGreaterThan(50);
    fireEvent.click(
      within(side.querySelector('.tdc-ap-chips') as HTMLElement).getByRole('button', {
        name: 'Calendar',
      }),
    );
    const cal = side.querySelectorAll('.tdc-pick[role="button"]').length;
    expect(cal).toBeLessThan(all);
    fireEvent.change(within(side).getByPlaceholderText('Search widgets'), {
      target: { value: 'zzzzqq' },
    });
    expect(within(side).getByText('Nothing found')).toBeTruthy();
    fireEvent.change(within(side).getByPlaceholderText('Search widgets'), {
      target: { value: 'sleep' },
    });
    const hit = side.querySelector<HTMLElement>('.tdc-pick[role="button"]')!;
    fireEvent.click(hit);
    save();
    expect(custom('mine')!.items[0].widget).toBeTruthy();
  });

  it('a widget click with no section that has room opens a new "Pair" section for it', () => {
    render(<Harness side={side} onClose={() => undefined} />);
    tab('Widgets');
    fireEvent.click(side.querySelector<HTMLElement>('.tdc-pick[role="button"]')!);
    save();
    const added = getTodayLayout().sections.find((s) => s.kind === 'custom') as CustomSection;
    expect(added.layout).toBe('pair');
    expect(added.items[0].widget).toBeTruthy();
  });

  it('clicking an empty slot targets it ("Picking…"), clicking it again cancels, and the chosen widget lands there', () => {
    pairSection();
    const { container } = render(<Harness side={side} onClose={() => undefined} />);
    const slot = () => container.querySelectorAll<HTMLElement>('.tdc-slot')[1];
    fireEvent.click(slot());
    expect(within(side).getByRole('status').textContent).toContain('Small slot');
    expect(slot().className).toContain('is-picking');
    fireEvent.click(slot());
    expect(within(side).queryByRole('status')).toBeNull();
    fireEvent.click(slot());
    fireEvent.click(side.querySelector<HTMLElement>('.tdc-pick[role="button"]')!);
    save();
    const items = custom('mine')!.items;
    expect(items[0].widget).toBe('');
    expect(items[1].widget).toBeTruthy();
  });

  it('shortcuts: grouped, searchable, "All N" reveals the long tail, picking a slot swaps a shortcut in place', () => {
    setTodayLayout(
      insertWidget(
        insertWidget(
          addSection(DEFAULT_LAYOUT, { id: 'sc', title: 'Quick', layout: 'shortcuts' }),
          'sc',
          'sc:sleep',
          'k1',
        ),
        'sc',
        'sc:weigh',
        'k2',
      ),
    );
    seed({ ...richState(), activities: activities() });
    const { container } = render(<Harness side={side} onClose={() => undefined} />);
    tab('Shortcuts');
    // favourite activities lead, the rest hide behind "All N"
    const shown = side.querySelectorAll('.tdc-ap-scgrid .tdc-ap-sc').length;
    fireEvent.click(within(side).getByRole('button', { name: /^All \d+$/ }));
    expect(side.querySelectorAll('.tdc-ap-scgrid .tdc-ap-sc').length).toBeGreaterThan(shown);
    fireEvent.change(within(side).getByPlaceholderText('Search shortcuts'), {
      target: { value: 'zzzzqq' },
    });
    expect(within(side).getByText('Nothing found')).toBeTruthy();
    fireEvent.change(within(side).getByPlaceholderText('Search shortcuts'), {
      target: { value: '' },
    });
    // select slot 0 (the Sleep shortcut) via its selection bar, then swap it
    fireEvent.click(container.querySelectorAll<HTMLElement>('.tdc-slot')[0]);
    fireEvent.click(
      within(container.querySelector('.tdc-selbar') as HTMLElement).getByRole('button', {
        name: 'Add widget',
      }),
    );
    fireEvent.click(within(side).getByRole('button', { name: 'Auto session' }));
    save();
    expect(custom('sc')!.items.map((w) => w.widget)).toEqual(['sc:auto', 'sc:weigh']);
  });

  it('a full shortcuts section dims every shortcut in the panel', () => {
    let l = addSection(DEFAULT_LAYOUT, { id: 'sc', title: 'Quick', layout: 'shortcuts' });
    for (let i = 0; i < 8; i++)
      l = insertWidget(
        l,
        'sc',
        [
          'sc:sleep',
          'sc:weigh',
          'sc:auto',
          'sc:log-past',
          'sc:injury',
          'sc:unwell',
          'sc:day-off',
          'sc:ask-atlas',
        ][i],
        `k${i}`,
      );
    setTodayLayout(l);
    render(<Harness side={side} onClose={() => undefined} />);
    tab('Shortcuts');
    const tiles = Array.from(side.querySelectorAll<HTMLElement>('.tdc-ap-sc'));
    expect(tiles.every((t) => t.getAttribute('aria-disabled') === 'true')).toBe(true);
    fireEvent.click(tiles[0]);
    save();
    expect(custom('sc')!.items).toHaveLength(8);
  });

  it('with no shortcuts section a shortcut click creates one', () => {
    render(<Harness side={side} onClose={() => undefined} />);
    tab('Shortcuts');
    fireEvent.click(within(side).getByRole('button', { name: 'Weigh-in' }));
    save();
    const sc = getTodayLayout().sections.find((s) => s.kind === 'custom') as CustomSection;
    expect(sc.layout).toBe('shortcuts');
    expect(sc.items.map((w) => w.widget)).toEqual(['sc:weigh']);
  });

  it('keyboard: Enter and Space on a panel tile add it; Escape-less keys do nothing', () => {
    render(<Harness side={side} onClose={() => undefined} />);
    fireEvent.click(
      within(side.querySelector('.tdc-ap-layouts') as HTMLElement).getByRole('button', {
        name: 'Pair',
      }),
    );
    const quad = within(side.querySelector('.tdc-ap-layouts') as HTMLElement).getByRole('button', {
      name: 'Quad',
    });
    fireEvent.keyDown(quad, { key: 'x' });
    fireEvent.keyDown(quad, { key: 'Enter' });
    fireEvent.keyDown(quad, { key: ' ' });
    save();
    const kinds = getTodayLayout()
      .sections.filter((s) => s.kind === 'custom')
      .map((s) => (s as CustomSection).layout);
    expect(kinds).toEqual(['pair', 'quad', 'quad']);
  });

  it('Configure buttons replace the phone icons, and the empty store still opens the panel', () => {
    seed(emptyState());
    render(<Harness side={side} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Configure · History' }));
    expect(screen.getByText('Days shown')).toBeTruthy();
  });

  it('drag handles reorder with the keyboard, Status has none', () => {
    render(<Harness side={side} onClose={() => undefined} />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Drag Program & week' }), {
      key: 'ArrowUp',
    });
    save();
    expect(ids()).toEqual(['status', 'program', 'atlas', 'nudges', 'history']);
  });
});

describe('Customize Today — locales', () => {
  it('opens and lists its sections in every locale', () => {
    for (const l of ['uk', 'pl', 'lt', 'et'] as const) {
      setLocale(l);
      const { unmount } = render(<Harness side={null} onClose={() => undefined} />);
      expect(document.querySelectorAll('.tdc-block').length).toBe(5);
      unmount();
    }
    act(() => setLocale('en'));
  });
});
