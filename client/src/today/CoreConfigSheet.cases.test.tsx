import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { CoreConfigSheet } from './CoreConfigSheet';
import {
  CORE_DEFAULTS,
  DEFAULT_LAYOUT,
  NUDGE_KINDS,
  coreOpts,
  setCoreOpts,
  type ConfigurableCore,
  type TodayLayout,
} from './layout';
import { setLocale } from '../i18n';

let latest: TodayLayout;

function Host({
  id,
  hasClients = true,
  start = DEFAULT_LAYOUT,
  onClose = () => undefined,
}: {
  id: ConfigurableCore;
  hasClients?: boolean;
  start?: TodayLayout;
  onClose?: () => void;
}) {
  const [draft, setDraft] = useState(start);
  useEffect(() => {
    latest = draft;
  }, [draft]);
  return (
    <CoreConfigSheet
      id={id}
      draft={draft}
      onChange={setDraft}
      preview={<div data-testid="preview">preview</div>}
      hasClients={hasClients}
      onClose={onClose}
    />
  );
}

const withOpts = <K extends ConfigurableCore>(id: K, patch: Partial<(typeof CORE_DEFAULTS)[K]>) =>
  setCoreOpts(DEFAULT_LAYOUT, id, patch as never);

beforeEach(() => {
  localStorage.clear();
  setLocale('en');
});
afterEach(cleanup);

describe('CoreConfigSheet — chrome', () => {
  it('titles the sheet with the block, says it is core, and Done closes it', () => {
    const onClose = vi.fn();
    render(<Host id="program" onClose={onClose} />);
    expect(screen.getByText(/Core block — configure or move/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('"Reset block" puts the defaults of that block back and leaves the others', () => {
    let l = withOpts('program', { style: 'detailed', exercises: true });
    l = setCoreOpts(l, 'history', { days: 7 });
    render(<Host id="program" start={l} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset block' }));
    expect(coreOpts(latest, 'program')).toEqual(CORE_DEFAULTS.program);
    expect(coreOpts(latest, 'history').days).toBe(7);
  });
});

describe('CoreConfigSheet — program', () => {
  it('shows the preview and changes the card style', () => {
    render(<Host id="program" />);
    expect(screen.getByTestId('preview')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Detailed' }));
    expect(coreOpts(latest, 'program').style).toBe('detailed');
    expect(screen.getByRole('button', { name: 'Detailed' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('each switch writes its own flag and only that one', () => {
    render(<Host id="program" />);
    const before = coreOpts(DEFAULT_LAYOUT, 'program');
    const flags: Array<[string, keyof typeof before]> = [
      ['Week pills', 'weekPills'],
      ['Exercise list', 'exercises'],
      ['Gym step', 'gymStep'],
      ['“Log past session” link', 'logPast'],
    ];
    for (const [name, key] of flags) {
      const sw = screen.getByRole('switch', { name });
      expect(sw.getAttribute('aria-checked')).toBe(String(before[key]));
      fireEvent.click(sw);
      expect(coreOpts(latest, 'program')[key]).toBe(!before[key]);
    }
    expect(coreOpts(latest, 'program').style).toBe(before.style);
  });
});

describe('CoreConfigSheet — atlas', () => {
  it('with clients and "together" offers only the layout choice and the clients toggles', () => {
    render(<Host id="atlas" />);
    expect(screen.getByText('Layout')).toBeTruthy();
    expect(screen.queryByText('Atlas view')).toBeNull();
    expect(screen.queryByText('Clients view')).toBeNull();
    expect(screen.queryByText('Order')).toBeNull();
    expect(screen.getByRole('switch', { name: 'Clients training now first' })).toBeTruthy();
  });

  it('switching to "split" reveals Atlas view, Clients view and Order', () => {
    render(<Host id="atlas" />);
    fireEvent.click(screen.getByRole('button', { name: /Split/ }));
    expect(coreOpts(latest, 'atlas').layout).toBe('split');
    expect(screen.getByText('Atlas view')).toBeTruthy();
    expect(screen.getByText('Clients view')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Quick chat/ }));
    expect(coreOpts(latest, 'atlas').atlasView).toBe('chat');
    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    expect(coreOpts(latest, 'atlas').clientsView).toBe('list');
    fireEvent.click(screen.getByRole('button', { name: 'Clients first' }));
    expect(coreOpts(latest, 'atlas').order).toBe('clients');
  });

  it('describes live-first differently for split stories vs the strip/list', () => {
    const split = withOpts('atlas', { layout: 'split', clientsView: 'stories' });
    const { unmount } = render(<Host id="atlas" start={split} />);
    expect(screen.queryByText('Anyone live leads the row')).toBeNull();
    expect(screen.getByText(/Live now/)).toBeTruthy();
    unmount();
    render(<Host id="atlas" start={withOpts('atlas', { layout: 'split', clientsView: 'list' })} />);
    expect(screen.getByText('Anyone live leads the row')).toBeTruthy();
  });

  it('live-first and hide-inactive toggles write their flags', () => {
    render(<Host id="atlas" />);
    fireEvent.click(screen.getByRole('switch', { name: 'Clients training now first' }));
    expect(coreOpts(latest, 'atlas').liveFirst).toBe(false);
    fireEvent.click(screen.getByRole('switch', { name: 'Hide clients inactive 30+ days' }));
    expect(coreOpts(latest, 'atlas').hideInactive).toBe(true);
  });

  it('without clients only the Atlas view is configurable', () => {
    render(<Host id="atlas" hasClients={false} />);
    expect(screen.queryByText('Layout')).toBeNull();
    expect(screen.queryByText('Clients view')).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Note of the day/ }));
    expect(coreOpts(latest, 'atlas').atlasView).toBe('note');
    expect(screen.getByRole('button', { name: /Off when no notes/ })).toBeTruthy();
  });
});

describe('CoreConfigSheet — nudges and history', () => {
  it('lists every nudge kind switched on, and a switch turns exactly that kind off and on again', () => {
    render(<Host id="nudges" />);
    expect(screen.getAllByRole('switch')).toHaveLength(NUDGE_KINDS.length);
    const sw = screen.getByRole('switch', { name: 'Weigh-in reminder' });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(sw);
    expect(coreOpts(latest, 'nudges').off).toEqual(['weigh']);
    fireEvent.click(screen.getByRole('switch', { name: 'Readiness' }));
    expect(coreOpts(latest, 'nudges').off).toEqual(['weigh', 'readiness']);
    fireEvent.click(screen.getByRole('switch', { name: 'Weigh-in reminder' }));
    expect(coreOpts(latest, 'nudges').off).toEqual(['readiness']);
  });

  it('a nudge that was already off starts unchecked', () => {
    render(<Host id="nudges" start={withOpts('nudges', { off: ['sleep'] })} />);
    expect(
      screen.getByRole('switch', { name: 'Sleep reminders' }).getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('history picks 3, 5 or 7 days and previews the block', () => {
    render(<Host id="history" />);
    expect(screen.getByTestId('preview')).toBeTruthy();
    const group = screen.getByRole('group', { name: 'Days shown' });
    expect(
      within(group)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['3', '5', '7']);
    fireEvent.click(within(group).getByRole('button', { name: '7' }));
    expect(coreOpts(latest, 'history').days).toBe(7);
  });
});
