import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, createEvent, fireEvent, render, screen, within } from '@testing-library/react';
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
} from './layout';
import { useTw } from './strings';
import type { ShortcutCtx } from './shortcuts';
import { __getStateForTests } from '../store';
import { setLocale, useT } from '../i18n';
import type { Shell } from '../App';

// A fixed clock: render must stay pure.
const NOW = new Date(2026, 8, 29, 12, 0).getTime();

const shell = {
  openOverlay: vi.fn(),
  replaceOverlay: vi.fn(),
  goTab: vi.fn(),
  goPlaybook: vi.fn(),
  openStart: vi.fn(),
  toast: vi.fn(),
  snack: vi.fn(),
  signOut: vi.fn(),
  queueLength: 0,
} as unknown as Shell;

function Harness({ side, onClose }: { side: HTMLElement | null; onClose: () => void }) {
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
  const coreFor = () =>
    Object.fromEntries(CORE_IDS.map((id) => [id, <div key={id}>{id}</div>])) as Record<
      CoreId,
      React.ReactNode
    >;
  return (
    <TodayCustomize coreFor={coreFor} hasClients={false} ctx={ctx} side={side} onClose={onClose} />
  );
}

const dt = () => ({
  setData: vi.fn(),
  setDragImage: vi.fn(),
  effectAllowed: 'all',
  dropEffect: 'none',
});
/** A drag event with a pointer position (jsdom has no DragEvent coordinates). */
function drag(kind: 'dragStart' | 'dragOver' | 'drop', el: Element, data: object, y = 0) {
  const ev = createEvent[kind](el, { dataTransfer: data });
  Object.defineProperty(ev, 'clientY', { value: y });
  fireEvent(el, ev);
}
const custom = (id: string) =>
  getTodayLayout().sections.find((s) => s.id === id) as CustomSection | undefined;

let side: HTMLElement;
beforeEach(() => {
  localStorage.clear();
  setLocale('en');
  let l = addSection(DEFAULT_LAYOUT, { id: 'sc', title: 'Shortcuts', layout: 'shortcuts' });
  l = insertWidget(l, 'sc', 'sc:sleep', 'w1');
  l = insertWidget(l, 'sc', 'sc:weigh', 'w2');
  l = addSection(l, { id: 'body', title: 'Body', layout: 'pair' });
  setTodayLayout(l);
  side = document.createElement('aside');
  document.body.appendChild(side);
});
afterEach(() => {
  cleanup();
  side.remove();
});

describe('Customize Today — mobile', () => {
  it('keeps the phone chrome: no handles, no panel, "Add section here" between sections', () => {
    render(<Harness side={null} onClose={() => undefined} />);
    expect(screen.queryAllByRole('button', { name: /^Drag / })).toHaveLength(0);
    expect(screen.getAllByText('Add section here').length).toBeGreaterThan(0);
    expect(screen.queryByText('Add to Today')).toBeNull();
  });
});

describe('Customize Today — desktop (D2)', () => {
  it('shows the title block, handles (Status pinned), Configure buttons and the panel', () => {
    render(<Harness side={side} onClose={() => undefined} />);
    expect(
      screen.getByText('Drag by the handle or use the arrows — same controls as on mobile.'),
    ).toBeTruthy();
    // Every section but Status has a handle.
    expect(screen.getAllByRole('button', { name: /^Drag / })).toHaveLength(6);
    expect(screen.queryByRole('button', { name: 'Drag Status' })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Configure · / })).toHaveLength(4);
    expect(within(side).getByText('Add to Today')).toBeTruthy();
    expect(screen.queryByText('Add section here')).toBeNull();
  });

  it('reorders sections by dragging the handle, and with ↑ ↓ on the focused handle', () => {
    const onClose = vi.fn();
    const { container } = render(<Harness side={side} onClose={onClose} />);
    const list = container.querySelector('.tdc') as HTMLElement;
    const data = dt();
    // jsdom lays everything out at 0: a pointer below every block drops at the end.
    drag('dragStart', screen.getByRole('button', { name: 'Drag Atlas & clients' }), data);
    drag('dragOver', list, data, 999);
    drag('drop', list, data, 999);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Drag History' }), { key: 'ArrowUp' });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(getTodayLayout().sections.map((s) => s.id)).toEqual([
      'status',
      'program',
      'history',
      'nudges',
      'sc',
      'body',
      'atlas',
    ]);
    expect(onClose).toHaveBeenCalled();
  });

  it('adds a section from the panel by drag (between sections) and by click (at the end)', () => {
    const { container } = render(<Harness side={side} onClose={() => undefined} />);
    const list = container.querySelector('.tdc') as HTMLElement;
    const data = dt();
    // Pointer above every block: lands right after Status.
    drag('dragStart', within(side).getByRole('button', { name: 'Quad' }), data);
    drag('dragOver', list, data, -1);
    expect(container.querySelector('.tdc-drop')).toBeTruthy();
    drag('drop', list, data, -1);
    fireEvent.click(within(side).getByRole('button', { name: 'Big' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const secs = getTodayLayout().sections;
    expect(secs[1].kind === 'custom' && secs[1].layout).toBe('quad');
    // After the last section that isn't History, like "Add section" on the phone.
    const last = secs[secs.length - 1];
    expect(last.kind === 'custom' && last.layout).toBe('big');
  });

  it('adds shortcuts by click (already added ones are dimmed) and by drop on the section', () => {
    render(<Harness side={side} onClose={() => undefined} />);
    const tabs = side.querySelector('.uiseg') as HTMLElement;
    fireEvent.click(within(tabs).getByRole('button', { name: 'Shortcuts' }));
    const sleep = within(side).getByRole('button', { name: 'Sleep' });
    expect(sleep.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(within(side).getByRole('button', { name: 'Home set' }));
    const data = dt();
    const target = screen
      .getByText('Shortcuts', { selector: '.tdc-name span' })
      .closest('.tdc-block') as HTMLElement;
    drag('dragStart', within(side).getByRole('button', { name: 'Log past' }), data);
    drag('dragOver', target, data);
    drag('drop', target, data);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(custom('sc')?.items.map((w) => w.widget)).toEqual([
      'sc:sleep',
      'sc:weigh',
      'sc:home-set',
      'sc:log-past',
    ]);
  });

  it('drops a widget into an empty slot and never into a shortcuts section', () => {
    const { container } = render(<Harness side={side} onClose={() => undefined} />);
    fireEvent.click(
      within(side.querySelector('.uiseg') as HTMLElement).getByRole('button', { name: 'Widgets' }),
    );
    const tile = side.querySelector('.tdc-pick[role="button"]') as HTMLElement;
    const widget = tile.getAttribute('aria-label');
    const data = dt();
    const scBlock = container.querySelectorAll('.tdc-block.is-custom')[0];
    const bodySlots = container
      .querySelectorAll('.tdc-block.is-custom')[1]
      .querySelectorAll('.tdc-slot');
    drag('dragStart', tile, data);
    drag('dragOver', scBlock.querySelector('.tdc-slot') as Element, data);
    drag('drop', scBlock.querySelector('.tdc-slot') as Element, data);
    drag('dragStart', tile, data);
    drag('dragOver', bodySlots[1], data);
    drag('drop', bodySlots[1], data);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(custom('sc')?.items).toHaveLength(2);
    const body = custom('body');
    expect(body?.items.map((w) => w.size)).toEqual(['S', 'S']);
    expect(body?.items[0].widget).toBe('');
    expect(body?.items[1].widget).toBeTruthy();
    expect(widget).toBeTruthy();
  });

  it('reorders shortcuts inside their section by dragging a tile', () => {
    const { container } = render(<Harness side={side} onClose={() => undefined} />);
    const slots = container
      .querySelectorAll('.tdc-block.is-custom')[0]
      .querySelectorAll('.tdc-slot');
    const data = dt();
    drag('dragStart', slots[1], data);
    drag('dragOver', slots[0], data);
    drag('drop', slots[0], data);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(custom('sc')?.items.map((w) => w.widget)).toEqual(['sc:weigh', 'sc:sleep']);
  });
});
