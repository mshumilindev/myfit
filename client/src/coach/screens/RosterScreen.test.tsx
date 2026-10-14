import { markReauthed } from '../security/reauth';
import { c360En as c360 } from '../../i18n/coachClient360.en';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rosterEn as r } from '../../i18n/coachRoster.en';
import { createFixturesPort } from '../data/__fixtures__/fixtures';
import { createLocalInvitePort, resetCreatedInvites } from '../data/inviteStore';
import { setViewport } from '../testViewport';
import { RosterScreen } from './RosterScreen';
import { emptyRoster, lockedClient, withInvites, worldPort } from './storyPorts';
import { safeEn } from '../../i18n/coachSafe.en';

afterEach(() => {
  cleanup();
  resetCreatedInvites();
});
beforeEach(() => setViewport(1440));

const mount = (over: Partial<Parameters<typeof RosterScreen>[0]> = {}) => {
  const onNavigate = vi.fn();
  const utils = render(
    <RosterScreen
      onNavigate={onNavigate}
      port={createFixturesPort()}
      invitePort={createLocalInvitePort()}
      unreadByClient={{}}
      {...over}
    />,
  );
  return { onNavigate, ...utils };
};
const list = () => within(screen.getByRole('list', { name: r.roListLabel }));

describe('Roster: data states', () => {
  it('loading: skeleton rows with a polite label, never a blocking overlay', () => {
    mount({ port: createFixturesPort({ delayMs: 60_000 }) });
    expect(screen.getByRole('status', { name: r.roLoading })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: r.roTitle })).toBeTruthy();
  });

  it('error with nothing to show: failed card + Try again that recovers', async () => {
    let fail = true;
    mount({ port: createFixturesPort({ failWith: () => (fail ? 'unavailable' : null) }) });
    expect(await screen.findByText(safeEn.pbUnknownTitle)).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: safeEn.retry }));
    await waitFor(() => expect(list().getAllByRole('button').length).toBeGreaterThan(5));
  });

  it('offline with cached data: quiet status line with age + Retry, the list stays', async () => {
    mount({ port: worldPort(undefined, { warm: true, failWith: () => 'offline' }) });
    const bar = await screen.findByText(/You are offline\. Showing data from 14 minutes ago/);
    expect(bar.closest('[role="status"]')).toBeTruthy();
    expect(screen.getByRole('button', { name: r.stRetry })).toBeTruthy();
    expect(list().getAllByRole('button').length).toBe(14);
  });

  it('healthy background refresh of a fresh cache: list at once, no status chip (F6)', async () => {
    mount({ port: worldPort(undefined, { warm: true, delayMs: 60_000 }) });
    expect(list().getAllByRole('button').length).toBe(14);
    expect(screen.queryByText(/Refreshing in the background/)).toBeNull();
    expect(screen.queryByRole('button', { name: r.stRetry })).toBeNull();
  });

  it('old cache still refreshing: quiet update time, no Retry', async () => {
    mount({ port: worldPort(undefined, { warm: true, delayMs: 60_000, cacheAgeMs: 40 * 60_000 }) });
    expect(list().getAllByRole('button').length).toBe(14);
    expect(await screen.findByText(/Updated .*Refreshing in the background/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: r.stRetry })).toBeNull();
  });
});

describe('Roster: list', () => {
  it('shows the 14 lab clients, needs-attention first, counts reconcile with the segmented control', async () => {
    mount();
    await screen.findByText(r.roSubtitle(14, 4));
    const rows = list().getAllByRole('button');
    expect(rows).toHaveLength(14);
    expect(rows[0].textContent).toContain('Urgent');
    const attn = screen.getByRole('button', { name: r.roAttn(4) });
    fireEvent.click(attn);
    expect(list().getAllByRole('button')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: r.roAll(14) }));
    expect(list().getAllByRole('button')).toHaveLength(14);
  });

  it('search by name or program, no-match state with Clear search', async () => {
    mount();
    await screen.findByText(r.roSubtitle(14, 4));
    const q = screen.getByRole('searchbox', { name: r.roSearch });
    fireEvent.change(q, { target: { value: 'glute' } });
    expect(list().getAllByRole('button')).toHaveLength(1);
    fireEvent.change(q, { target: { value: 'zzz' } });
    expect(screen.getByText(r.roNoMatch('zzz'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: r.roClearSearch, hidden: false }));
    expect(list().getAllByRole('button')).toHaveLength(14);
  });

  it('filters: logging mode narrows; "All logging" restores', async () => {
    mount();
    await screen.findByText(r.roSubtitle(14, 4));
    fireEvent.click(screen.getByRole('button', { name: r.roFilters }));
    fireEvent.change(screen.getByLabelText(r.roLoggingLabel), { target: { value: 'program' } });
    const n = list().getAllByRole('button').length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(14);
    expect(list().getAllByText(r.ivProgram).length).toBe(n);
    fireEvent.change(screen.getByLabelText(r.roLoggingLabel), { target: { value: 'all' } });
    expect(list().getAllByRole('button')).toHaveLength(14);
  });

  it('pending invites are rows of their own with the days left', async () => {
    mount({ port: worldPort(withInvites) });
    expect(await screen.findByText(r.roInviteLeft(6))).toBeTruthy();
    expect(screen.getByText(r.roPendingH(1))).toBeTruthy();
    expect(screen.getByText(r.roClientsH(14))).toBeTruthy();
    // the subtitle counts clients, not invites
    expect(screen.getByText(r.roSubtitle(14, 4))).toBeTruthy();
  });

  it('desktop: row selects (detail), Open client navigates; the detail never shows a not-shared restriction', async () => {
    const { onNavigate } = mount({ port: worldPort(lockedClient) });
    await screen.findByText(r.roSubtitle(14, 4));
    const detail = screen.getByRole('region', { name: 'Oleh Bondar' });
    expect(detail).toBeTruthy();
    const viktoriia = list().getByRole('button', { name: /Viktoriia Danylchuk/ });
    fireEvent.click(viktoriia);
    expect(onNavigate).not.toHaveBeenCalled();
    const sel = screen.getByRole('region', { name: 'Viktoriia Danylchuk' });
    expect(within(sel).getByText(r.roNotShared)).toBeTruthy();
    expect(within(sel).queryByText(r.roNoneReported)).toBeNull();
    fireEvent.click(within(sel).getByRole('button', { name: r.roOpenClient }));
    expect(onNavigate).toHaveBeenCalledWith({ screen: 'client', cid: expect.any(String) });
  });

  it('phone: no detail column; a row goes straight to Client 360; Invite is in the header', async () => {
    setViewport(390);
    const { onNavigate } = mount();
    await screen.findByText(r.roSubtitle(14, 4));
    expect(screen.queryByRole('region')).toBeNull();
    fireEvent.click(list().getAllByRole('button')[0]);
    expect(onNavigate).toHaveBeenCalledWith({ screen: 'client', cid: expect.any(String) });
    expect(screen.getByRole('button', { name: r.roInviteShort })).toBeTruthy();
    expect(screen.getByRole('button', { name: r.roExport })).toBeTruthy();
  });

  it('unread per client shows the 9+ rule with a spoken name', async () => {
    mount({ unreadByClient: { c2: 12 } });
    await screen.findByText(r.roSubtitle(14, 4));
    const row = list().getByRole('button', { name: /Maria Tkach/ });
    expect(
      within(row).getByRole('img', { name: r.c3MessageUnread('Maria', 12) }).textContent,
    ).toContain('9+');
  });

  it('export downloads a CSV of exactly the listed rows', async () => {
    let blob: Blob | null = null;
    Object.assign(URL, {
      createObjectURL: (b: Blob) => ((blob = b), 'blob:x'),
      revokeObjectURL: () => undefined,
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    markReauthed();
    mount();
    await screen.findByText(r.roSubtitle(14, 4));
    fireEvent.click(screen.getByRole('button', { name: r.roAttn(4) }));
    // iteration 14: Roster export goes through the kit ExportMenu (rows, columns, consent note), then the password check
    fireEvent.click(screen.getByRole('button', { name: r.roExport }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: /./ })).getByRole('button', {
        name: c360.exSubmit,
      }),
    );
    await waitFor(() => expect(click).toHaveBeenCalled());
    const text = await (blob as unknown as Blob).text();
    const lines = text.replace('﻿', '').split('\r\n');
    expect(lines[0]).toBe(r.roCsvCols.join(','));
    expect(lines).toHaveLength(1 + 4);
    expect(text).not.toMatch(/restriction|sleep/i);
    click.mockRestore();
  });
});

describe('Roster: invite (roster-invite, -hybrid, -program)', () => {
  it('desktop: Invite client opens the panel in the detail column; app invite shows a link and a pending row', async () => {
    mount();
    await screen.findByText(r.roSubtitle(14, 4));
    fireEvent.click(screen.getByRole('button', { name: r.roInvite }));
    expect(screen.getByRole('heading', { name: r.ivTitle })).toBeTruthy();
    fireEvent.change(screen.getByLabelText(new RegExp('^' + r.ivName)), {
      target: { value: 'Olena Marchenko' },
    });
    fireEvent.click(screen.getByRole('button', { name: r.ivSubmitApp }));
    expect(await screen.findByText(r.ivSentApp)).toBeTruthy();
    expect((screen.getByLabelText(r.ivLink) as HTMLInputElement).value).toMatch(
      /#\/invite\/[A-Za-z0-9_-]+$/,
    );
    expect(screen.getByText('Olena Marchenko')).toBeTruthy();
    expect(screen.getByText(r.roInviteLeft(7))).toBeTruthy();
  });

  it('program-only: added at once, no link, listed as Added; consent picker is not offered', async () => {
    mount();
    await screen.findByText(r.roSubtitle(14, 4));
    fireEvent.click(screen.getByRole('button', { name: r.roInvite }));
    fireEvent.click(
      within(screen.getByRole('group', { name: r.ivModeGroup })).getByRole('button', {
        name: r.ivProgram,
      }),
    );
    expect(screen.queryByRole('button', { name: r.ivConsentShow })).toBeNull();
    fireEvent.change(screen.getByLabelText(new RegExp('^' + r.ivName)), {
      target: { value: 'Dmytro Kovalenko' },
    });
    fireEvent.click(screen.getByRole('button', { name: r.ivSubmitProgram }));
    expect(await screen.findByText(r.ivSentProgram)).toBeTruthy();
    expect(screen.queryByLabelText(r.ivLink)).toBeNull();
    expect(screen.getByText(r.roProgramNoInvite)).toBeTruthy();
  });

  it('offline: the panel keeps the name and says so', async () => {
    mount({ invitePort: createLocalInvitePort({ fail: 'offline' }) });
    await screen.findByText(r.roSubtitle(14, 4));
    fireEvent.click(screen.getByRole('button', { name: r.roInvite }));
    fireEvent.change(screen.getByLabelText(new RegExp('^' + r.ivName)), {
      target: { value: 'Olena' },
    });
    fireEvent.click(screen.getByRole('button', { name: r.ivSubmitApp }));
    expect((await screen.findByRole('alert')).textContent).toContain(r.ivErrorOffline);
    expect((screen.getByLabelText(new RegExp('^' + r.ivName)) as HTMLInputElement).value).toBe(
      'Olena',
    );
  });

  it('phone: the panel opens inline above the list', async () => {
    setViewport(390);
    mount();
    await screen.findByText(r.roSubtitle(14, 4));
    fireEvent.click(screen.getByRole('button', { name: r.roInviteShort }));
    expect(screen.getByRole('heading', { name: r.ivTitle })).toBeTruthy();
  });
});

describe('Roster: empty (rosterEmpty)', () => {
  it('invite-first card, how it works; same InvitePanel', async () => {
    mount({ port: worldPort(emptyRoster) });
    expect(await screen.findByRole('heading', { name: r.roEmptyH })).toBeTruthy();
    expect(screen.getByText(r.roEmptyIntro)).toBeTruthy();
    expect(screen.getByText(r.roClientsN(0))).toBeTruthy();
    expect(screen.getByRole('heading', { name: r.roHowH })).toBeTruthy();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole('group', { name: r.ivModeGroup })).toBeTruthy();
    // no sample workspace: the app holds no demo data
    expect(screen.queryByText(/sample|demo/i)).toBeNull();
  });
});
