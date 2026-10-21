import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFixturesPort, buildFixtureWorld } from '../data/__fixtures__/fixtures';
import type { CoachWorldPort } from '../data/port';
import { setViewport } from '../testViewport';
import type { RescheduleRequestPort } from './requestPort';

/** Test double: answers resolve at once and nothing is persisted (the real port is the Schedule's). */
const pendingRequestPort: RescheduleRequestPort = {
  accept: () => Promise.resolve(),
  decline: () => Promise.resolve(),
  cancel: () => Promise.resolve(),
  propose: () => undefined,
};
import { TodayScreen } from './TodayScreen';
import { currentHash } from '../../route';

const OPTS = { refreshEveryMs: 0 };

function setup(
  port: CoachWorldPort = createFixturesPort(),
  extra: { requestPort?: RescheduleRequestPort; onNavigate?: () => void } = {},
) {
  const onNavigate = extra.onNavigate ?? vi.fn();
  render(
    <TodayScreen
      port={port}
      worldOptions={OPTS}
      onNavigate={onNavigate}
      requestPort={extra.requestPort}
    />,
  );
  return { onNavigate };
}

beforeEach(() => {
  setViewport(1440);
  window.history.replaceState(null, '', '#/c/agenda');
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '#/c/agenda');
});

const ready = () => screen.findByRole('heading', { level: 2, name: /Needs a decision/i });

describe('default request port', () => {
  it('"Propose another" opens the Schedule counter form for that request', async () => {
    const onNavigate = vi.fn();
    render(
      <TodayScreen
        port={createFixturesPort()}
        worldOptions={{ refreshEveryMs: 0 }}
        onNavigate={onNavigate}
      />,
    );
    await screen.findByRole('heading', { level: 2, name: /Reschedule requests/ });
    fireEvent.click(screen.getByRole('button', { name: 'Propose another time to Oleh' }));
    expect(currentHash()).toBe('#/c/schedule?form=counter&req=rq1');
    expect(onNavigate).not.toHaveBeenCalled();
  });
});

describe('Agenda: by priority', () => {
  it('draws the loading state inline (skeletons, no counts, no dialog) before the data', async () => {
    setup(createFixturesPort({ delayMs: 60 }));
    expect(screen.getByRole('heading', { level: 1, name: 'Agenda' })).toBeTruthy();
    expect(screen.getByText('Loading')).toBeTruthy();
    expect(screen.queryByText(/need a decision/)).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    await ready();
    expect(screen.queryByText('Loading')).toBeNull();
  });

  it('lists requests, needs a decision, keep an eye on and the digest; at most 5 cards', async () => {
    setup();
    await ready();
    expect(screen.getByRole('heading', { level: 2, name: /Reschedule requests/ })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /Keep an eye on/ })).toBeTruthy();
    expect(screen.getByText('2 need a decision, 1 request to answer')).toBeTruthy();
    const needs = screen.getByRole('region', { name: /Needs a decision/, hidden: true });
    expect(needs).toBeTruthy();
    const rows = screen.getAllByRole('button').filter((b) => b.className.includes('ros-row'));
    expect(rows.length).toBeLessThanOrEqual(5);
    expect(screen.getByRole('button', { name: /more in the digest/ })).toBeTruthy();
    expect(screen.getByText(/The digest is the morning summary/)).toBeTruthy();
  });

  it('opens the detail pane without navigation; the primary is the suggested option; Message is text, not an option', async () => {
    setup();
    await ready();
    const oleh = screen
      .getAllByRole('button')
      .find((b) =>
        /Oleh Bondar: Bench press has not moved/.test(b.getAttribute('aria-label') ?? ''),
      )!;
    fireEvent.click(oleh);
    expect(oleh.getAttribute('aria-current')).toBe('true');
    expect(currentHash()).toContain('open=');
    expect(currentHash().startsWith('#/c/agenda')).toBe(true);
    const primary = screen.getByRole('button', { name: 'Add a variation + 1 set' });
    expect(primary).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Message Oleh' })).toBeTruthy();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByRole('button', { name: 'See evidence and options' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '1 other option' })).toBeTruthy();
    // the chart has a text alternative
    expect(
      screen
        .getAllByRole('img')
        .some((i) => /Bench press/.test(i.getAttribute('aria-label') ?? '')),
    ).toBe(true);
  });

  it('records the suggested option from Today and lands on the recorded state', async () => {
    const port = createFixturesPort();
    setup(port);
    await ready();
    fireEvent.click(
      screen
        .getAllByRole('button')
        .find((b) => /Oleh Bondar: Bench press/.test(b.getAttribute('aria-label') ?? ''))!,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a variation + 1 set' }));
    expect(await screen.findByRole('status', { name: 'Decision recorded' })).toBeTruthy();
    await waitFor(() =>
      expect(port.saved().decisions.some((d) => d.optionId === 'variation')).toBe(true),
    );
    const rec = port.saved().decisions.find((d) => d.optionId === 'variation')!;
    expect(rec.message).toMatch(/Oleh/);
    expect(rec.evidence.length).toBeGreaterThan(0);
  });

  it('shows the reschedule requests with names that include the client and answers through the port', async () => {
    const port: RescheduleRequestPort = {
      ...pendingRequestPort,
      accept: vi.fn(() => Promise.resolve()),
      decline: vi.fn(() => Promise.resolve()),
      cancel: vi.fn(() => Promise.resolve()),
      propose: vi.fn(),
    };
    setup(createFixturesPort(), { requestPort: port });
    await ready();
    expect(screen.getByText('Oleh asks to move a session')).toBeTruthy();
    expect(screen.getByText(/Work trip, back on Saturday/)).toBeTruthy();
    expect(screen.getByText('Needs your answer')).toBeTruthy();
    // trainer-initiated request: waiting, can only be cancelled
    expect(screen.getAllByText('Waiting for Maria').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Accept move for Maria/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Propose another time to Oleh' }));
    expect(port.propose).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'c1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Accept move for Oleh' }));
    expect(await screen.findByText('Accepted. Oleh gets the new time in chat.')).toBeTruthy();
    expect(port.accept).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel request to Maria' }));
    await waitFor(() => expect(port.cancel).toHaveBeenCalledTimes(1));
  });

  it('keeps the card and shows an error when answering fails', async () => {
    const port: RescheduleRequestPort = {
      ...pendingRequestPort,
      decline: vi.fn(() => Promise.reject(new Error('x'))),
    };
    setup(createFixturesPort(), { requestPort: port });
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Decline move for Oleh' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Decline move for Oleh' })).toBeTruthy();
  });

  it('digest: expands the remaining items', async () => {
    setup();
    await ready();
    const before = screen
      .getAllByRole('button')
      .filter((b) => b.className.includes('ros-row')).length;
    fireEvent.click(screen.getByRole('button', { name: /more in the digest/ }));
    const after = screen
      .getAllByRole('button')
      .filter((b) => b.className.includes('ros-row')).length;
    expect(after).toBeGreaterThan(before);
  });

  it('all clear: nothing to decide, requests stay on top', async () => {
    const base = createFixturesPort();
    const w = buildFixtureWorld();
    const empty = { ...w, inputs: [] };
    const port: CoachWorldPort = { ...base, peek: () => null, load: async () => empty };
    setup(port);
    expect(await screen.findByText('No decisions waiting')).toBeTruthy();
    expect(screen.getByText(/One request waits for your answer above/)).toBeTruthy();
    expect(screen.getByText('0 need a decision, 1 request to answer')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'See the board' })).toBeTruthy();
  });
});

describe('Agenda: states that never block', () => {
  it('fresh cache refreshing in the background: no chip at all (F6)', async () => {
    setup(createFixturesPort({ warm: true, delayMs: 150 }));
    expect(await screen.findByRole('heading', { level: 2, name: /Needs a decision/ })).toBeTruthy();
    expect(screen.queryByText(/Updated .*/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('stale: quiet "Updated, refreshing" row once the cache is older than the threshold', async () => {
    setup(createFixturesPort({ warm: true, delayMs: 150, cacheAgeMs: 40 * 60_000 }));
    expect(await screen.findByText(/Updated .*, refreshing/)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /Needs a decision/ })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('offline with cached data: neutral note with Retry, the data stays', async () => {
    setup(createFixturesPort({ warm: true, failWith: () => 'offline' }));
    expect(await screen.findByText(/Offline\. Showing data from/)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /Needs a decision/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('error without data replaces the content with Retry; Retry recovers', async () => {
    let fail = true;
    setup(createFixturesPort({ failWith: () => (fail ? 'unavailable' : null) }));
    expect(await screen.findByText("Couldn't load Coach")).toBeTruthy();
    expect(screen.getByText(/Nothing was lost|safe/)).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: /Try again|Retry/i }));
    await ready();
  });

  it('forbidden: no access state, not a spinner', async () => {
    setup(createFixturesPort({ failWith: () => 'forbidden' }));
    expect(await screen.findByText("Coach isn't available for this account")).toBeTruthy();
  });
});

describe('Agenda: by stage', () => {
  it('shows the five stages as regions, counts, and the summary sentence', async () => {
    setup();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'By stage' }));
    expect(currentHash()).toContain('view=stage');
    const board = screen.getByRole('region', { name: 'Stage board, scroll for more' });
    for (const s of ['Signal', 'Evidence', 'Decided', 'Measuring', 'Result']) {
      expect(
        within(board).getByRole('heading', { level: 2, name: new RegExp(`^${s}`) }),
      ).toBeTruthy();
    }
    expect(screen.getByText(/decisions improved \(62%\)/)).toBeTruthy();
    expect(screen.getByText(/at least 2\.5 kg of estimated 1RM/)).toBeTruthy();
  });

  it('a signal card opens the decision drawer; Esc closes it and focus returns', async () => {
    setup();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'By stage' }));
    const card = screen
      .getAllByRole('button')
      .find((b) => /Oleh Bondar, Urgent/.test(b.getAttribute('aria-label') ?? ''))!;
    card.focus();
    fireEvent.click(card);
    const dlg = await screen.findByRole('dialog', { name: 'Decision' });
    expect(within(dlg).getByRole('button', { name: 'Add a variation + 1 set' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('phone: stages are an accordion, one open at a time', async () => {
    setViewport(390);
    setup();
    await screen.findByRole('heading', { level: 2, name: /Needs a decision/ });
    fireEvent.click(screen.getByRole('button', { name: 'By stage' }));
    const heads = screen
      .getAllByRole('button')
      .filter((b) => b.className.includes('uistage-acc-b'));
    expect(heads).toHaveLength(5);
    expect(heads.every((h) => h.getAttribute('aria-expanded') === 'false')).toBe(true);
    fireEvent.click(heads[1]);
    expect(heads[1].getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(heads[0]);
    expect(heads[1].getAttribute('aria-expanded')).toBe('false');
    expect(heads[0].getAttribute('aria-expanded')).toBe('true');
  });
});

describe('Agenda: phone', () => {
  it('expands the first decision in place (no side pane) and keeps the pills reachable', async () => {
    setViewport(390);
    setup();
    await ready();
    expect(
      screen
        .getAllByRole('heading', { level: 3 })
        .some((h) =>
          /Bench press has not moved|conflicts with a restriction/.test(h.textContent ?? ''),
        ),
    ).toBe(true);
    expect(screen.getByRole('button', { name: 'All signals' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'All decisions' })).toBeTruthy();
  });
});

describe('Agenda: navigation callbacks', () => {
  it('All signals / All decisions / Message go through onNavigate', async () => {
    const { onNavigate } = setup();
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'All signals' }));
    expect(onNavigate).toHaveBeenCalledWith({ screen: 'signals' });
    fireEvent.click(screen.getByRole('button', { name: 'All decisions' }));
    expect(onNavigate).toHaveBeenCalledWith({ screen: 'decisions' });
    await act(async () => undefined);
  });
});
