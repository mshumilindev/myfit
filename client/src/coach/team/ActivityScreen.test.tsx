import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { teamEn as tm } from '../../i18n/coachTeam.en';
import { setViewport } from '../testViewport';
import { createFixturesTeamPort } from './__fixtures__/fixtures';
import { ActivityScreen } from './ActivityScreen';
import { RolesScreen } from './RolesScreen';

afterEach(cleanup);
beforeEach(() => setViewport(1440));
const NOW = Date.UTC(2026, 9, 20, 12, 0);
const mount = (o = {}, onNavigate = vi.fn()) =>
  render(
    <ActivityScreen
      now={NOW}
      onNavigate={onNavigate}
      port={createFixturesTeamPort({ now: () => NOW, ...o })}
    />,
  );

describe('Activity log', () => {
  it('trainer: reads everything, grouped by day, with live statuses and chips per person', async () => {
    mount();
    expect(await screen.findByText(tm.actSubOwner)).toBeTruthy();
    expect(screen.getByRole('heading', { name: tm.actToday })).toBeTruthy();
    expect(screen.getByRole('heading', { name: tm.actYesterday })).toBeTruthy();
    expect(screen.getAllByText(tm.actKind['move-request']!).length).toBeGreaterThan(1);
    expect(screen.getAllByText(tm.actStatus.pending!).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: tm.actEveryone })).toBeTruthy();
    expect(screen.getByRole('button', { name: tm.actMe })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Irina M.' })).toBeTruthy();
  });

  it('a chip narrows the log to one person', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Irina M.' }));
    await waitFor(() => expect(screen.queryByText(/Olena K\. ·/)).toBeNull());
    expect(screen.getAllByText(/Irina M\. ·/).length).toBeGreaterThan(0);
  });

  it('manager with own scope: only their own actions, no filter, and the hint names the owner', async () => {
    mount({ viewer: 'manager' });
    expect(await screen.findByText(new RegExp(tm.actSubOwn))).toBeTruthy();
    expect(screen.getByText(/Olena K\. can allow you/)).toBeTruthy();
    expect(screen.queryByText(/Olena K\. ·/)).toBeNull();
    expect(screen.queryByRole('button', { name: tm.actEveryone })).toBeNull();
  });

  it('manager allowed to see all: the whole team, with Mine / Everyone chips', async () => {
    mount({ viewer: 'manager', activityScope: 'all' });
    expect(await screen.findByText(tm.actSubAll)).toBeTruthy();
    expect(screen.getByRole('button', { name: tm.actMine })).toBeTruthy();
    expect(screen.getAllByText(/Olena K\. ·/).length).toBeGreaterThan(0);
  });

  it('a failed load shows a retry that loads again', async () => {
    let fail = true;
    mount({ failWith: () => (fail ? 'unavailable' : null) });
    expect(await screen.findByText(tm.actFailed)).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: tm.tmRetry }));
    expect(await screen.findByText(tm.actSubOwner)).toBeTruthy();
  });

  it('Back returns to the Team page', async () => {
    const nav = vi.fn();
    mount({}, nav);
    fireEvent.click(await screen.findByRole('button', { name: tm.tmTitle }));
    expect(nav).toHaveBeenCalledWith({ screen: 'team' });
  });
});

describe('Activity log pagination (SPO-203)', () => {
  it('loads one page, then older ones from the cursor; the button goes when the log ends', async () => {
    const port = createFixturesTeamPort({ now: () => NOW, activityPage: 4 });
    const spy = vi.spyOn(port, 'activity');
    render(<ActivityScreen now={NOW} onNavigate={vi.fn()} port={port} />);
    await screen.findByText(tm.actSubOwner);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toBeUndefined();
    // 4 of 9 rows
    expect(document.querySelectorAll('.act-day li').length).toBe(4);
    fireEvent.click(screen.getByRole('button', { name: tm.actMore }));
    await waitFor(() => expect(document.querySelectorAll('.act-day li').length).toBe(8));
    // the cursor is the oldest ts of what is shown, never a count or a page number
    const first = await spy.mock.results[0]!.value;
    expect(spy.mock.calls[1]![0]).toEqual({ before: first.next });
    fireEvent.click(screen.getByRole('button', { name: tm.actMore }));
    await waitFor(() => expect(document.querySelectorAll('.act-day li').length).toBe(9));
    expect(screen.queryByRole('button', { name: tm.actMore })).toBeNull();
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('a short log has no button; a failed page says so and keeps what is shown', async () => {
    mount();
    await screen.findByText(tm.actSubOwner);
    expect(screen.queryByRole('button', { name: tm.actMore })).toBeNull();
    cleanup();
    const port = createFixturesTeamPort({ now: () => NOW, activityPage: 4 });
    const real = port.activity.bind(port);
    port.activity = vi.fn(async (page) => {
      if (page?.before) throw new Error('offline');
      return real(page);
    });
    render(<ActivityScreen now={NOW} onNavigate={vi.fn()} port={port} />);
    await screen.findByText(tm.actSubOwner);
    fireEvent.click(screen.getByRole('button', { name: tm.actMore }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(document.querySelectorAll('.act-day li').length).toBe(4);
    expect(screen.getByRole('button', { name: tm.actMore })).toBeTruthy();
  });

  it('a server that ignores the cursor cannot loop: a page with nothing new ends the log', async () => {
    const base = createFixturesTeamPort({ now: () => NOW, activityPage: 4 });
    const first = await base.activity();
    const port = { ...base, activity: vi.fn(async () => first) };
    render(<ActivityScreen now={NOW} onNavigate={vi.fn()} port={port} />);
    await screen.findByText(tm.actSubOwner);
    fireEvent.click(screen.getByRole('button', { name: tm.actMore }));
    await waitFor(() => expect(screen.queryByRole('button', { name: tm.actMore })).toBeNull());
    expect(document.querySelectorAll('.act-day li').length).toBe(4);
  });
});

describe('Roles', () => {
  it('lists every capability for both roles and states the manager limits', () => {
    render(<RolesScreen onNavigate={() => undefined} />);
    const table = screen.getByRole('table', { name: tm.rlTableLabel });
    expect(within(table).getAllByRole('row').length).toBe(tm.rlRows.length + 1);
    const removeClient = within(table).getByText('Remove a client').closest('tr')!;
    expect(removeClient.textContent).toContain(tm.rlByRequest);
    const chat = within(table).getByText('Chat with clients').closest('tr')!;
    expect(chat.textContent).toContain(tm.rlNo);
  });
});
