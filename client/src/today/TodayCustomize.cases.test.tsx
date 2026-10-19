import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { TodayCustomize } from './TodayCustomize';
import {
  CORE_IDS,
  CORE_DEFAULTS,
  DEFAULT_LAYOUT,
  addSection,
  coreOpts,
  getTodayLayout,
  insertWidget,
  setCoreOpts,
  setTodayLayout,
  setWidget,
  type CoreId,
  type CustomSection,
  type TodayLayout,
} from './layout';
import { useTw } from './strings';
import type { ShortcutCtx } from './shortcuts';
import { setLocale, useT } from '../i18n';
import { NOW, makeShell, richState, seed } from './__fixtures__/widgetHarness';
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

describe('Customize Today — phone: leaving', () => {
  it('Save is disabled until something changes; Cancel with no change closes at once', () => {
    const onClose = vi.fn();
    render(<Harness side={null} onClose={onClose} />);
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Discard changes?')).toBeNull();
  });

  it('Cancel after a change asks first; "Keep editing" stays, "Discard" leaves without saving', () => {
    const onClose = vi.fn();
    render(<Harness side={null} onClose={onClose} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Move down' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Discard changes?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByText('Discard changes?')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(ids()).toEqual(CORE_IDS);
  });

  it('adds the editing class to the body while open and removes it on close', () => {
    const { unmount } = render(<Harness side={null} onClose={() => undefined} />);
    expect(document.body.classList.contains('td-editing')).toBe(true);
    unmount();
    expect(document.body.classList.contains('td-editing')).toBe(false);
  });

  it('"Reset to default" restores the default layout in the draft, and Save stores it', () => {
    setTodayLayout(addSection(DEFAULT_LAYOUT, { id: 'x', title: 'Mine', layout: 'pair' }));
    render(<Harness side={null} onClose={() => undefined} />);
    expect(screen.getByText('Mine')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reset to default' }));
    expect(screen.queryByText('Mine')).toBeNull();
    save();
    expect(ids()).toEqual(CORE_IDS);
  });
});

describe('Customize Today — phone: core blocks', () => {
  it('the tags say what a block is set to, and the status block is pinned with a hint', () => {
    render(<Harness side={null} onClose={() => undefined} />);
    expect(screen.getByText('Always first')).toBeTruthy();
    expect(screen.getByText('Injury, illness and rest banners appear here')).toBeTruthy();
    expect(screen.getByText('Core · Compact')).toBeTruthy(); // Atlas without clients: his view
    expect(screen.getByText('Core · Standard')).toBeTruthy();
    expect(screen.getByText('Core · 11 of 11 on')).toBeTruthy();
    expect(screen.getByText('Core · 5 days')).toBeTruthy();
  });

  it('with clients the Atlas tag shows the layout instead', () => {
    render(<Harness side={null} onClose={() => undefined} hasClients />);
    expect(screen.getByText('Core · Together')).toBeTruthy();
  });

  it('configuring a block changes the draft live (tag and preview) and Save keeps it', () => {
    render(<Harness side={null} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Configure · Program & week' }));
    fireEvent.click(screen.getByRole('button', { name: 'Detailed' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByText('Core · Detailed')).toBeTruthy();
    expect(document.body.textContent).toContain('"style":"detailed"');
    save();
    expect(coreOpts(getTodayLayout(), 'program').style).toBe('detailed');
    expect(coreOpts(getTodayLayout(), 'atlas')).toEqual(CORE_DEFAULTS.atlas);
  });

  it('nudges summary counts the ones switched off', () => {
    setTodayLayout(setCoreOpts(DEFAULT_LAYOUT, 'nudges', { off: ['weigh', 'sleep'] }));
    render(<Harness side={null} onClose={() => undefined} />);
    expect(screen.getByText('Core · 9 of 11 on')).toBeTruthy();
  });

  it('moves a core block with the arrows; the one under Status cannot go up, the last cannot go down', () => {
    render(<Harness side={null} onClose={() => undefined} />);
    const ups = screen.getAllByRole('button', { name: 'Move up' }) as HTMLButtonElement[];
    const downs = screen.getAllByRole('button', { name: 'Move down' }) as HTMLButtonElement[];
    expect(ups[0].disabled).toBe(true);
    expect(downs[downs.length - 1].disabled).toBe(true);
    fireEvent.click(downs[0]);
    save();
    expect(ids()).toEqual(['status', 'program', 'atlas', 'nudges', 'history']);
  });
});

describe('Customize Today — phone: sections', () => {
  it('"Add section" asks for a title and a layout and puts it before History', () => {
    render(<Harness side={null} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }));
    expect(screen.getByText('New section')).toBeTruthy();
    expect(screen.getByText(/Goes after/).textContent).toBe('Goes after Nudges & reminders');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  Gym day  ' } });
    fireEvent.click(screen.getByRole('button', { name: /Quad/ }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Add section' }),
    );
    save();
    const added = getTodayLayout().sections[ids().length - 2] as CustomSection;
    expect(added).toMatchObject({ kind: 'custom', title: 'Gym day', layout: 'quad' });
    expect(ids()[ids().length - 1]).toBe('history');
  });

  it('a blank title falls back to "My section"', () => {
    render(<Harness side={null} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '   ' } });
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Add section' }),
    );
    save();
    expect((getTodayLayout().sections[ids().length - 2] as CustomSection).title).toBe('My section');
  });

  it('"Add section here" inserts right after the section above it', () => {
    render(<Harness side={null} onClose={() => undefined} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Add section here' })[1]);
    expect(screen.getByText(/Goes after/).textContent).toBe('Goes after Atlas & clients');
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Add section' }),
    );
    save();
    expect(ids().slice(0, 3)).toEqual(['status', 'atlas', expect.stringMatching(/^sec/)]);
  });

  it('cancelling the new-section sheet adds nothing', () => {
    render(<Harness side={null} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' }).at(-1)!);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });

  const withSection = (layout: 'pair' | 'quad' | 'shortcuts', widgets: string[]) => {
    let l = addSection(DEFAULT_LAYOUT, { id: 'mine', title: 'Mine', layout });
    for (const w of widgets) l = insertWidget(l, 'mine', w, `i-${w}`);
    setTodayLayout(l);
  };

  it('edits a section title and layout; switching layout warns what would be removed', () => {
    let l = addSection(DEFAULT_LAYOUT, { id: 'mine', title: 'Mine', layout: 'quad' });
    l = setWidget(l, 'mine', 0, 'streak', 'a');
    l = setWidget(l, 'mine', 1, 'sleep-last', 'b');
    l = setWidget(l, 'mine', 3, 'body-weight', 'c');
    setTodayLayout(l);
    render(<Harness side={null} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit section' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: /^Pair/ }));
    expect(screen.getByRole('status').textContent).toMatch(/Widgets that won’t fit: 1/);
    fireEvent.click(screen.getByRole('button', { name: /^Shortcuts/ }));
    expect(screen.getByRole('status').textContent).toMatch(/items to remove: 3/);
    fireEvent.click(screen.getByRole('button', { name: /^Rows/ }));
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
    save();
    expect(custom('mine')).toMatchObject({ title: 'Renamed', layout: 'rows' });
  });

  it('removing a section asks first, says how many widgets go, and Cancel keeps it', () => {
    withSection('pair', []);
    let l = getTodayLayout();
    l = setWidget(l, 'mine', 0, 'streak', 'a');
    setTodayLayout(l);
    render(<Harness side={null} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove section' }));
    expect(screen.getByText('Remove “Mine”?')).toBeTruthy();
    expect(screen.getByText(/The section and its 1 widgets leave Today/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' }).at(-1)!);
    expect(screen.getByText('Mine')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove section' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.queryByText('Mine')).toBeNull();
    save();
    expect(custom('mine')).toBeUndefined();
  });

  it('an empty section is removed with the short text', () => {
    withSection('pair', []);
    render(<Harness side={null} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove section' }));
    expect(screen.getByText(/The section leaves Today\. Your data stays/)).toBeTruthy();
  });
});

describe('Customize Today — phone: filling slots', () => {
  const pairSection = () => {
    setTodayLayout(addSection(DEFAULT_LAYOUT, { id: 'mine', title: 'Mine', layout: 'pair' }));
  };

  it('an empty slot opens the picker at that slot size; search narrows, "Put … here" places it', () => {
    pairSection();
    render(<Harness side={null} onClose={() => undefined} />);
    fireEvent.click(screen.getAllByRole('button', { name: /Add widget/ })[0]);
    const dlg = screen.getByRole('dialog');
    expect(within(dlg).getByText('Small slot')).toBeTruthy();
    expect(
      (within(dlg).getByRole('button', { name: 'Add widget' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.change(within(dlg).getByPlaceholderText('Search widgets'), {
      target: { value: 'zzzzqq' },
    });
    expect(within(dlg).getByText('Nothing found')).toBeTruthy();
    fireEvent.change(within(dlg).getByPlaceholderText('Search widgets'), {
      target: { value: 'streak' },
    });
    const first = dlg.querySelector<HTMLElement>('.tdc-pick')!;
    fireEvent.click(first);
    const name = first.getAttribute('aria-label')!;
    fireEvent.click(within(dlg).getByRole('button', { name: `Put ${name} here` }));
    expect(screen.queryByRole('dialog')).toBeNull();
    save();
    expect(custom('mine')!.items[0].widget).not.toBe('');
  });

  it('picker group chips narrow to one group and "All" brings the rest back', () => {
    pairSection();
    render(<Harness side={null} onClose={() => undefined} />);
    fireEvent.click(screen.getAllByRole('button', { name: /Add widget/ })[0]);
    const dlg = screen.getByRole('dialog');
    const before = dlg.querySelectorAll('.tdc-pick').length;
    fireEvent.click(
      within(dlg.querySelector('.tdc-chips') as HTMLElement).getByRole('button', {
        name: 'Calendar',
      }),
    );
    const after = dlg.querySelectorAll('.tdc-pick').length;
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
    fireEvent.click(
      within(dlg.querySelector('.tdc-chips') as HTMLElement).getByRole('button', { name: 'All' }),
    );
    expect(dlg.querySelectorAll('.tdc-pick').length).toBe(before);
  });

  it('the Shortcuts sheet toggles shortcuts up to the limit, shows the count and applies on Done', () => {
    setTodayLayout(
      insertWidget(
        addSection(DEFAULT_LAYOUT, { id: 'mine', title: 'Mine', layout: 'shortcuts' }),
        'mine',
        'sc:sleep',
        'k',
      ),
    );
    render(<Harness side={null} onClose={() => undefined} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[0]);
    const dlg = screen.getByRole('dialog');
    expect(within(dlg).getByText('1 of 8')).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: /Weigh-in/ }));
    expect(within(dlg).getByText('2 of 8')).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: /Sleep/ })); // untick
    expect(within(dlg).getByText('1 of 8')).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: /^All \d+$/ }));
    fireEvent.change(within(dlg).getByPlaceholderText('Search shortcuts'), {
      target: { value: 'zzzzqq' },
    });
    expect(within(dlg).getByText('Nothing found')).toBeTruthy();
    fireEvent.change(within(dlg).getByPlaceholderText('Search shortcuts'), {
      target: { value: 'run' },
    });
    fireEvent.click(within(dlg).getAllByRole('button', { name: /Run/ })[0]);
    fireEvent.click(within(dlg).getByRole('button', { name: 'Done' }));
    save();
    expect(custom('mine')!.items.map((w) => w.widget)).toEqual(['sc:weigh', 'sc:act:run']);
  });

  it('the Shortcuts sheet will not take a ninth shortcut', () => {
    setTodayLayout(addSection(DEFAULT_LAYOUT, { id: 'mine', title: 'Mine', layout: 'shortcuts' }));
    render(<Harness side={null} onClose={() => undefined} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[0]);
    const dlg = screen.getByRole('dialog');
    fireEvent.click(within(dlg).getByRole('button', { name: 'Activities' }));
    const tiles = Array.from(dlg.querySelectorAll<HTMLElement>('.tdc-sc button'));
    for (const b of tiles.slice(0, 12)) fireEvent.click(b);
    expect(within(dlg).getByText('8 of 8')).toBeTruthy();
  });

  it('selecting a placed widget shows its bar: move left/right, swap, remove', () => {
    let l = addSection(DEFAULT_LAYOUT, { id: 'mine', title: 'Mine', layout: 'quad' });
    l = setWidget(l, 'mine', 0, 'streak', 'a');
    l = setWidget(l, 'mine', 1, 'sleep-last', 'b');
    setTodayLayout(l);
    render(<Harness side={null} onClose={() => undefined} />);
    const slots = () => document.querySelectorAll<HTMLElement>('.tdc-slot');
    fireEvent.click(slots()[0]);
    expect(slots()[0].getAttribute('aria-pressed')).toBe('true');
    const bar = () => document.querySelector('.tdc-selbar') as HTMLElement;
    expect(
      (within(bar()).getByRole('button', { name: 'Move up' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(within(bar()).getByRole('button', { name: 'Move down' }));
    fireEvent.click(within(bar()).getByRole('button', { name: 'Remove' }));
    expect(document.querySelector('.tdc-selbar')).toBeNull();
    save();
    expect(
      custom('mine')!
        .items.filter((w) => w.widget)
        .map((w) => w.id),
    ).toEqual(['b']);
  });

  it('swap (⇄) re-opens the picker on the selected slot and replaces the widget', () => {
    setTodayLayout(
      setWidget(
        addSection(DEFAULT_LAYOUT, { id: 'mine', title: 'Mine', layout: 'pair' }),
        'mine',
        0,
        'streak',
        'a',
      ),
    );
    render(<Harness side={null} onClose={() => undefined} />);
    fireEvent.click(document.querySelectorAll<HTMLElement>('.tdc-slot')[0]);
    fireEvent.click(
      within(document.querySelector('.tdc-selbar') as HTMLElement).getByRole('button', {
        name: 'Add widget',
      }),
    );
    const dlg = screen.getByRole('dialog');
    fireEvent.click(dlg.querySelectorAll<HTMLElement>('.tdc-pick')[2]);
    fireEvent.click(dlg.querySelector('.tdc-pick-foot button') as HTMLElement);
    save();
    expect(custom('mine')!.items[0].widget).not.toBe('streak');
  });

  it('an unknown widget id in a saved layout shows as an empty slot instead of crashing', () => {
    setTodayLayout(
      setWidget(
        addSection(DEFAULT_LAYOUT, { id: 'mine', title: 'Mine', layout: 'pair' }),
        'mine',
        0,
        'no-such-widget',
        'a',
      ),
    );
    render(<Harness side={null} onClose={() => undefined} />);
    expect(screen.getAllByRole('button', { name: /Add widget/ }).length).toBe(2);
  });
});
