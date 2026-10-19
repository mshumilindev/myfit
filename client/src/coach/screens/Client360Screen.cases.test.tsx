/** Client 360 shell: who the header actions point at, the end-coaching flow behind the password, what a tab open logs. */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notesEn } from '../../i18n/coachNotes.en';
import { rosterEn as r } from '../../i18n/coachRoster.en';
import { safeEn as sf } from '../../i18n/coachSafe.en';
import { buildFixtureWorld, createFixturesPort } from '../data/__fixtures__/fixtures';
import { createLocalReadLog } from '../data/readLog';
import type { CoachWorldPort } from '../data/port';
import { chatRoute } from '../routes';
import { readScheduleParams } from '../schedule/useScheduleParams';
import { configureReauth, forgetReauth } from '../security/reauth';
import { createFixturesReauthPort } from '../security/__fixtures__/reauth';
import { setViewport } from '../testViewport';
import { Client360Screen } from './Client360Screen';
import { idOf, totalsOnlyClient, worldPort } from './storyPorts';

const W = buildFixtureWorld();
const OLEH = idOf(W, 'Oleh Bondar');
const VIK = idOf(W, 'Viktoriia Danylchuk');

beforeEach(() => {
  setViewport(1440);
  window.location.hash = '';
});
afterEach(() => {
  cleanup();
  configureReauth(null);
  forgetReauth();
});

function mount(over: Partial<Parameters<typeof Client360Screen>[0]> = {}, port?: CoachWorldPort) {
  const onNavigate = vi.fn();
  const utils = render(
    <Client360Screen
      cid={OLEH}
      onNavigate={onNavigate}
      port={port ?? createFixturesPort()}
      unreadByClient={{}}
      {...over}
    />,
  );
  return { onNavigate, ...utils };
}
const openMenu = async () =>
  fireEvent.click(await screen.findByRole('button', { name: r.c3MenuLabel }));

describe('the header actions point at THIS client', () => {
  it("Message opens this client's thread, not anyone else's", async () => {
    const { onNavigate } = mount();
    fireEvent.click(await screen.findByRole('button', { name: `${r.c3Message} Oleh` }));
    expect(onNavigate).toHaveBeenLastCalledWith(chatRoute(OLEH));
  });

  it('Schedule opens the plan form for this client', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: r.c3Schedule }));
    expect(readScheduleParams(window.location.hash)).toMatchObject({ form: 'plan', client: OLEH });
  });

  it('the menu: reschedule picks a session of this client, schedule plans one, edit opens the programs', async () => {
    const { onNavigate } = mount();
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: r.c3MenuReschedule }));
    expect(readScheduleParams(window.location.hash)).toMatchObject({ form: 'pick', client: OLEH });
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: r.c3MenuSchedule }));
    expect(readScheduleParams(window.location.hash)).toMatchObject({ form: 'plan', client: OLEH });
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: r.c3MenuEdit }));
    expect(onNavigate).toHaveBeenLastCalledWith({ screen: 'programs' });
  });

  it('"Ask to share" is offered while something is left to ask for, and opens this client\'s thread', async () => {
    const { onNavigate } = mount();
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: r.c3MenuAsk('Oleh') }));
    expect(onNavigate).toHaveBeenLastCalledWith(chatRoute(OLEH));
  });

  it('a program-only client has nothing to ask for, so the menu does not offer it', async () => {
    const programOnly = worldPort((w) => ({
      ...w,
      clients: w.clients.map((c) => (c.id === OLEH ? { ...c, mode: 'program' as const } : c)),
    }));
    mount({}, programOnly);
    await openMenu();
    expect(screen.queryByRole('menuitem', { name: r.c3MenuAsk('Oleh') })).toBeNull();
    expect(screen.getByRole('menuitem', { name: r.c3MenuMessage('Oleh') })).toBeTruthy();
  });

  it('phone: Message and Schedule are icon buttons that go to the same places', async () => {
    setViewport(390);
    const { onNavigate } = mount({ unreadByClient: { [OLEH]: 2 } });
    fireEvent.click(await screen.findByRole('button', { name: r.c3MessageUnread('Oleh', 2) }));
    expect(onNavigate).toHaveBeenLastCalledWith(chatRoute(OLEH));
    fireEvent.click(screen.getByRole('button', { name: r.c3Schedule }));
    expect(readScheduleParams(window.location.hash)).toMatchObject({ form: 'plan', client: OLEH });
  });
});

describe("the trainer's own security code", () => {
  it('the menu opens the code dialog and Close returns to the client', async () => {
    mount();
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: sf.scMenu }));
    expect((await screen.findAllByText(sf.scTitle)).length).toBeGreaterThan(0);
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getAllByRole('button', { name: sf.scClose }).at(-1)!,
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });
});

describe('ways out of the screen', () => {
  it('Back returns to the clients list', async () => {
    const { onNavigate } = mount();
    await screen.findAllByRole('tab'); // the loaded screen (the skeleton has a Back too)
    fireEvent.click(screen.getByRole('button', { name: r.roBack }));
    expect(onNavigate).toHaveBeenLastCalledWith({ screen: 'clients' });
  });

  it('an unknown client offers the way back, and a revoked one offers it plus "ask again" in THIS client\'s thread', async () => {
    const a = mount({ cid: 'nobody' });
    fireEvent.click(await screen.findByRole('button', { name: r.stBackToClients }));
    expect(a.onNavigate).toHaveBeenLastCalledWith({ screen: 'clients' });
    cleanup();
    const b = mount({ revoked: true });
    fireEvent.click(await screen.findByRole('button', { name: r.stBackToClients }));
    expect(b.onNavigate).toHaveBeenLastCalledWith({ screen: 'clients' });
    fireEvent.click(screen.getByRole('button', { name: r.stAskAgain('Oleh') }));
    expect(b.onNavigate).toHaveBeenLastCalledWith(chatRoute(OLEH));
  });

  it("a note's context line opens the right page for THIS client", async () => {
    const { onNavigate } = mount({ tab: 'notes' });
    const region = await screen.findByRole('region', { name: notesEn.nTitle('Oleh') });
    const open = (re: RegExp) =>
      fireEvent.click(within(region).getAllByRole('button', { name: re })[0]);
    open(new RegExp(notesEn.nAnchorMessage('')));
    expect(onNavigate).toHaveBeenLastCalledWith(chatRoute(OLEH));
    open(new RegExp(notesEn.nAnchorDay('')));
    expect(onNavigate).toHaveBeenLastCalledWith({ screen: 'client', cid: OLEH, tab: 'program' });
  });
});

describe('end coaching', () => {
  const endItem = () => screen.getByRole('menuitem', { name: sf.ecMenu('Oleh') });
  function spied() {
    const port = createFixturesPort();
    const end = vi.spyOn(port, 'endCoaching' as never) as unknown as ReturnType<typeof vi.fn>;
    return { port, end };
  }

  it('asks first, says what stops, and Cancel changes nothing', async () => {
    const { port, end } = spied();
    const { onNavigate } = mount({}, port);
    await openMenu();
    fireEvent.click(endItem());
    const dlg = await screen.findByRole('alertdialog');
    expect(within(dlg).getByText(sf.ecTitle('Oleh'))).toBeTruthy();
    expect(within(dlg).getByText(sf.ecEffectSee('Oleh'))).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: sf.raCancel }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(end).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('confirming still needs the password: a wrong one ends nothing, the right one ends it for THIS client and returns to the clients', async () => {
    configureReauth(createFixturesReauthPort({ accept: 'secret' }));
    const { port, end } = spied();
    const { onNavigate } = mount({}, port);
    await openMenu();
    fireEvent.click(endItem());
    fireEvent.click(await screen.findByRole('button', { name: sf.ecConfirm }));
    const pw = await screen.findByLabelText(/Password/);
    fireEvent.change(pw, { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: sf.raConfirm }));
    await new Promise((res) => setTimeout(res, 30));
    expect(end).not.toHaveBeenCalled();
    fireEvent.change(await screen.findByLabelText(/Password/), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: sf.raConfirm }));
    await waitFor(() => expect(end).toHaveBeenCalledTimes(1));
    expect(end).toHaveBeenCalledWith(OLEH);
    await waitFor(() => expect(onNavigate).toHaveBeenLastCalledWith({ screen: 'clients' }));
  });

  it('a backend that cannot end coaching says so calmly and stays on the client', async () => {
    configureReauth(createFixturesReauthPort());
    const port: CoachWorldPort = { ...createFixturesPort(), endCoaching: undefined };
    const { onNavigate } = mount({}, port);
    await openMenu();
    fireEvent.click(endItem());
    fireEvent.click(await screen.findByRole('button', { name: sf.ecConfirm }));
    fireEvent.change(await screen.findByLabelText(/Password/), { target: { value: 'anything' } });
    fireEvent.click(screen.getByRole('button', { name: sf.raConfirm }));
    expect(await screen.findByText(sf.ecFailed)).toBeTruthy();
    expect(onNavigate).not.toHaveBeenCalled();
  });
});

describe('what opening a tab logs (the client sees these reads)', () => {
  it('Overview logs only the categories this client shares; a client sharing totals only logs totals and nothing else', async () => {
    const log = createLocalReadLog();
    mount({ cid: VIK, readLog: log }, worldPort(totalsOnlyClient));
    await screen.findAllByRole('tab');
    await waitFor(() => expect(log.entries.length).toBeGreaterThan(0));
    expect(log.entries.map((e) => e.category)).toEqual(['totals']);
    expect(log.entries.every((e) => e.clientId === VIK && e.via === 'view')).toBe(true);
  });

  it('Overview of a client who shares totals, sets and injuries logs all three; each is one entry', async () => {
    const log = createLocalReadLog();
    mount({ cid: OLEH, readLog: log });
    await screen.findAllByRole('tab');
    await waitFor(() => expect(log.entries.length).toBeGreaterThan(0));
    expect(log.entries.map((e) => e.category).sort()).toEqual(['injury', 'sets', 'totals']);
  });

  it('Decisions logs sets (the evidence it draws) when sets are shared, and nothing when they are not', async () => {
    const log = createLocalReadLog();
    mount({ cid: OLEH, tab: 'decisions', readLog: log });
    await screen.findAllByRole('tab');
    await waitFor(() => expect(log.entries.length).toBeGreaterThan(0));
    expect(log.entries.map((e) => e.category)).toEqual(['sets']);
    cleanup();
    const quiet = createLocalReadLog();
    mount({ cid: VIK, tab: 'decisions', readLog: quiet }, worldPort(totalsOnlyClient));
    await screen.findAllByRole('tab');
    await new Promise((res) => setTimeout(res, 30));
    expect(quiet.entries).toEqual([]);
  });

  it('an access-revoked client logs nothing and draws no tabs', async () => {
    const log = createLocalReadLog();
    mount({ readLog: log, revoked: true });
    expect(await screen.findByRole('alert')).toBeTruthy();
    await new Promise((res) => setTimeout(res, 30));
    expect(log.entries).toEqual([]);
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  it('a pending invite is not a client yet: the empty state, no reads', async () => {
    const log = createLocalReadLog();
    const port = worldPort((w) => ({
      ...w,
      clients: [
        ...w.clients,
        { ...w.clients[0], id: 'inv9', invite: { sentAt: w.asOf, expiresAt: w.asOf + 1 } },
      ],
    }));
    mount({ cid: 'inv9', readLog: log }, port);
    expect(await screen.findByText(r.stNoClientTitle)).toBeTruthy();
    expect(log.entries).toEqual([]);
  });
});
