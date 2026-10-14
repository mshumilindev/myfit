import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { liveEn as lv } from '../../../i18n/coachLive.en';
import { createFixturesPort } from '../../data/__fixtures__/fixtures';
import { setViewport } from '../../testViewport';
import { createFixturesLivePort, defaultLiveSessions } from './__fixtures__/fixtures';
import { LiveClientScreen, LiveScreen } from './LiveScreens';
import { canShowLive, clockText, liveRows, tonnesText } from './model';
import { configureCoachData } from '../../data/config';
import type { CoachClient } from '../../domain/types';
import { ALL_OFF } from '../../domain/consent';

afterEach(cleanup);
beforeEach(() => {
  setViewport(1440);
  configureCoachData({ world: createFixturesPort(), uid: 't1' });
});

const NOW = Date.UTC(2026, 9, 7, 9, 5);
const client = (id: string, over: Partial<CoachClient> = {}): CoachClient =>
  ({
    id,
    name: `Client ${id}`,
    goal: 'g',
    program: 'p',
    programWeek: 1,
    gym: 'Iron Yard',
    mode: 'app',
    consent: { ...ALL_OFF, totals: 'on' },
    ...over,
  }) as unknown as CoachClient;

describe('live model', () => {
  const map = (...cs: CoachClient[]) => new Map(cs.map((c) => [c.id, c] as const));
  const sessions = defaultLiveSessions(NOW);

  it('classifies live / offline / finished and orders live first', () => {
    const rows = liveRows(
      sessions,
      map(client('c5'), client('c11'), client('c2'), client('c7')),
      NOW,
    );
    expect(rows.map((r) => [r.client.id, r.state])).toEqual([
      ['c11', 'live'],
      ['c5', 'live'],
      ['c2', 'offline'],
      ['c7', 'finished'],
    ]);
  });

  it('the clock runs while live, freezes at the last heartbeat when offline, is final when finished', () => {
    const cs = map(client('c5'), client('c2'), client('c7'));
    const at = (t: number) =>
      liveRows(
        sessions.map((s) => ({ ...s })),
        cs,
        t,
      );
    const a = at(NOW).find((r) => r.client.id === 'c5')!;
    const b = at(NOW + 60_000).find((r) => r.client.id === 'c5');
    // a minute later the same session has had no heartbeat for 72 s: still live, clock +60 s
    expect(b!.elapsedMs - a.elapsedMs).toBe(60_000);
    const off = at(NOW).find((r) => r.client.id === 'c2')!;
    const off2 = at(NOW + 30_000).find((r) => r.client.id === 'c2')!;
    expect(off.state).toBe('offline');
    expect(off2.elapsedMs).toBe(off.elapsedMs);
    const fin = at(NOW).find((r) => r.client.id === 'c7')!;
    expect(fin.elapsedMs).toBe(68 * 60_000);
    // a finished session drops out after 5 minutes
    expect(at(NOW + 5 * 60_000).some((r) => r.client.id === 'c7')).toBe(false);
  });

  it('never shows a program-only client or one who shares no totals', () => {
    const rows = liveRows(
      sessions,
      map(
        client('c5', { mode: 'program' }),
        client('c11', { consent: { ...ALL_OFF } }),
        client('c2'),
      ),
      NOW,
    );
    expect(rows.map((r) => r.client.id)).toEqual(['c2']);
    expect(canShowLive(client('x', { mode: 'program' }))).toBe(false);
  });

  it('two open sessions of one client collapse into the newest', () => {
    const [a] = sessions;
    const rows = liveRows(
      [{ ...a, id: 'old', startedAt: a.startedAt - 60 * 60_000 }, a],
      map(client('c5')),
      NOW,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].session.id).toBe(a.id);
    expect(rows[0].duplicates).toBe(1);
  });

  it('formats the clock and the tonnes', () => {
    expect(clockText(38 * 60_000)).toBe('38:00');
    expect(clockText(3_900_000)).toBe('1:05:00');
    expect(tonnesText(7400)).toBe('7.4');
  });
});

describe('Live list', () => {
  it('lists the sessions with their state and opens a client', async () => {
    const onNavigate = vi.fn();
    render(
      <LiveScreen
        onNavigate={onNavigate}
        port={createFixturesLivePort({ freeze: true })}
        uid="t1"
      />,
    );
    const list = await screen.findByRole('list', { name: lv.lvListLabel });
    await waitFor(() => expect(within(list).getAllByRole('button').length).toBe(4));
    const names = within(list)
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'));
    expect(names[0]).toMatch(/Training now$/);
    fireEvent.click(within(list).getAllByRole('button')[0]);
    expect(onNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ screen: 'client', tab: 'live' }),
    );
  });

  it('says so when nobody is training', async () => {
    render(
      <LiveScreen
        onNavigate={vi.fn()}
        port={createFixturesLivePort({ sessions: () => [], freeze: true })}
        uid="t1"
      />,
    );
    expect(await screen.findByText(lv.lvNoneH)).toBeTruthy();
  });
});

describe('Live client page', () => {
  const mount = (cid: string, extra = {}) =>
    render(
      <LiveClientScreen
        cid={cid}
        onNavigate={vi.fn()}
        port={createFixturesLivePort({ freeze: true, ...extra })}
        uid="t1"
      />,
    );

  it('shows the five service fields, the last session and the read-only note, and no set grid', async () => {
    mount('c5');
    const fields = await screen.findByLabelText(lv.lvFieldsLabel);
    const text = fields.textContent ?? '';
    for (const k of [lv.lvFName, lv.lvFStarted, lv.lvFGym, lv.lvFExercises, lv.lvFHeartbeat])
      expect(text).toContain(k);
    expect(text).toContain('Lower A');
    expect(text).toContain('08:27');
    expect(text).toContain('Iron Yard');
    expect(screen.getByRole('timer').textContent).toContain('38:00');
    expect(screen.getByRole('timer').getAttribute('aria-live')).toBe('off');
    expect(screen.getByText(lv.lvLastLine('Upper B', 18, '7.4'))).toBeTruthy();
    expect(document.body.textContent).toContain('appear in Denys');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('offline: status word, frozen clock and last seen', async () => {
    mount('c2');
    await screen.findByRole('timer');
    expect(document.body.textContent).toContain(lv.lvStatusOffline);
    expect(document.body.textContent).toContain('Last seen 3 min ago');
  });

  it('finished: the totals line', async () => {
    mount('c7');
    await screen.findByRole('timer');
    expect(document.body.textContent).toContain('18 sets');
    expect(document.body.textContent).toContain('7.4 t');
  });

  it('a client who is not training gets the empty state', async () => {
    mount('c1');
    expect(await screen.findByText(lv.lvNoneClientH('Oleh'))).toBeTruthy();
  });
});
