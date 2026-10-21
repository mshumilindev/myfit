import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { teamEn as tm } from '../../i18n/coachTeam.en';
import { setViewport } from '../testViewport';
import { createFixturesSchedulePort } from '../schedule/__fixtures__/fixtures';
import { configureSchedule } from '../schedule/useSchedule';
import { scheduleEn as sc } from '../../i18n/coachSchedule.en';
import { MANAGER_CLIENTS } from './__fixtures__/managerClients';
import { createFixturesTeamPort } from './__fixtures__/fixtures';
import { createStaticManagerClients, createUnavailableManagerClients } from './managerClients';
import { ManagerClientsScreen } from './ManagerClientsScreen';

afterEach(() => {
  cleanup();
  configureSchedule(null);
});
beforeEach(() => setViewport(1440));
const mount = (rows = MANAGER_CLIENTS) =>
  render(
    <ManagerClientsScreen onNavigate={() => undefined} port={createStaticManagerClients(rows)} />,
  );

describe('Manager Clients', () => {
  it('counts the clients and the ready ones, and says how many have not opened the app', () => {
    mount();
    expect(screen.getByText(tm.mcSub(14, 9))).toBeTruthy();
    expect(screen.getByText(tm.mcPending(5))).toBeTruthy();
  });

  it('a client without delegated keys waits; the others show their next session', () => {
    mount();
    const list = screen.getByRole('list', { name: tm.mcListLabel });
    const row = within(list).getByText('Taras Rudenko').closest('li')!;
    expect(row.textContent).toContain(tm.mcWaiting);
    expect(within(list).getAllByText(tm.mcWaiting)).toHaveLength(5);
  });

  it('filters by trainer with the count on the chip', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: tm.mcTrainerChip('Andriy P.', 6) }));
    const list = screen.getByRole('list', { name: tm.mcListLabel });
    expect(within(list).getAllByRole('listitem')).toHaveLength(6);
    expect(within(list).queryByText('Oleh Bondar')).toBeNull();
  });

  it('searches by name or trainer', () => {
    mount();
    fireEvent.change(screen.getByPlaceholderText(tm.mcSearch), { target: { value: 'lysenko' } });
    expect(
      within(screen.getByRole('list', { name: tm.mcListLabel })).getAllByRole('listitem'),
    ).toHaveLength(1);
    fireEvent.change(screen.getByPlaceholderText(tm.mcSearch), { target: { value: 'zzz' } });
    expect(screen.getByText(tm.mcNoMatch)).toBeTruthy();
  });

  it('no clients: the empty state; not read yet: no sample people', () => {
    mount([]);
    expect(screen.getByText(tm.mcEmptyTitle)).toBeTruthy();
    cleanup();
    render(
      <ManagerClientsScreen
        onNavigate={() => undefined}
        port={createUnavailableManagerClients()}
      />,
    );
    expect(screen.queryByText('Oleh Bondar')).toBeNull();
  });

  it('asks the trainer to remove a client: the dialog says nothing changes until approved, the request goes out with the reason', async () => {
    const sent: [string, string][] = [];
    const team = {
      ...createFixturesTeamPort({ viewer: 'manager' }),
      requestRemoval: async (id: string, reason: string) => void sent.push([id, reason]),
    };
    render(
      <ManagerClientsScreen
        onNavigate={() => undefined}
        port={createStaticManagerClients(MANAGER_CLIENTS)}
        teamPort={team}
      />,
    );
    fireEvent.click(screen.getByText(tm.mcRequestRemoval));
    const dlg = await screen.findByRole('alertdialog');
    expect(dlg.textContent).toContain(tm.mcAskBody('Andriy P.'));
    fireEvent.change(within(dlg).getByRole('textbox'), { target: { value: 'Paused' } });
    fireEvent.click(within(dlg).getByRole('button', { name: tm.mcAskSend }));
    expect(await screen.findByText(tm.mcAskSent('Andriy P.'))).toBeTruthy();
    expect(sent).toEqual([['c2', 'Paused']]);
  });
});

describe('Manager invites a client', () => {
  it('asks the name and the trainer, then hands over the link', async () => {
    render(
      <ManagerClientsScreen
        onNavigate={() => undefined}
        port={createStaticManagerClients(MANAGER_CLIENTS)}
        teamPort={createFixturesTeamPort({ viewer: 'manager' })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: tm.icButton }));
    const dlg = await screen.findByRole('dialog');
    fireEvent.click(within(dlg).getByRole('button', { name: tm.icCreate }));
    expect(within(dlg).getByText(tm.icErrName)).toBeTruthy();
    fireEvent.change(within(dlg).getByRole('textbox'), { target: { value: 'Nina Test' } });
    fireEvent.click(within(dlg).getByRole('button', { name: tm.icCreate }));
    expect(await screen.findByDisplayValue(/invite\/ninatest/)).toBeTruthy();
  });
});

describe('List and card content (SPO-202 AC 1-3)', () => {
  const list = () => screen.getByRole('list', { name: tm.mcListLabel });

  it('the Segmented is "All 14 / Olena K. 8 / Andriy P. 6"', () => {
    mount();
    const group = screen.getByRole('group', { name: tm.mcFilterLabel });
    const names = within(group)
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(names).toEqual([
      tm.mcAll(14),
      tm.mcTrainerChip('Olena K.', 8),
      tm.mcTrainerChip('Andriy P.', 6),
    ]);
  });

  it('a row: avatar, name, the trainer and the Next session tag; none of the trainer-side extras', () => {
    configureSchedule(createFixturesSchedulePort());
    mount();
    const row = within(list()).getByText('Oleh Bondar').closest('li')!;
    expect(row.querySelector('.avatar')).toBeTruthy();
    expect(row.textContent).toContain('Olena K.');
    expect(row.textContent).toContain(tm.mcNextShort);
    // no stories strip, signals or health filters on the manager's list
    expect(screen.queryByRole('region', { name: /stories/i })).toBeNull();
    expect(screen.queryByText(/signal|health|nutrition/i)).toBeNull();
  });

  it('the Notice counts the clients who have not opened Spotter yet', () => {
    mount();
    const note = screen.getByText(tm.mcPending(5)).closest('[role], div')!;
    expect(note).toBeTruthy();
  });

  it('a waiting client opens a card without a schedule: Waiting, Open schedule disabled, no sessions lists', () => {
    mount();
    fireEvent.click(within(list()).getByText('Taras Rudenko'));
    const card = screen.getByRole('complementary', { name: 'Taras Rudenko' });
    expect(within(card).getByText(tm.mcWaiting)).toBeTruthy();
    expect(
      (within(card).getByRole('button', { name: tm.mcOpenSchedule }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(within(card).queryByText(tm.mcUpcoming)).toBeNull();
    expect(within(card).queryByText(tm.mcRecent)).toBeNull();
  });

  it('a ready client card: name, trainer, next and latest sessions, Open schedule, Request removal; no tabs and no Message', () => {
    configureSchedule(createFixturesSchedulePort());
    const nav = vi.fn();
    render(
      <ManagerClientsScreen onNavigate={nav} port={createStaticManagerClients(MANAGER_CLIENTS)} />,
    );
    fireEvent.click(within(list()).getByText('Oleh Bondar'));
    const card = screen.getByRole('complementary', { name: 'Oleh Bondar' });
    expect(within(card).getByRole('heading', { name: 'Oleh Bondar' })).toBeTruthy();
    expect(within(card).getByText('Olena Kovalenko')).toBeTruthy();
    expect(within(card).getByText(tm.mcUpcoming)).toBeTruthy();
    expect(within(card).getByText(tm.mcRecent)).toBeTruthy();
    expect(
      within(card).getAllByText(sc.scDone).length + within(card).queryAllByText(sc.scMissed).length,
    ).toBeGreaterThan(0);
    expect(within(card).queryByRole('tab')).toBeNull();
    for (const gone of [/workouts/i, /health/i, /nutrition/i, /notes/i, /program/i, /message/i])
      expect(within(card).queryByRole('button', { name: gone })).toBeNull();
    fireEvent.click(within(card).getByRole('button', { name: tm.mcOpenSchedule }));
    expect(nav).toHaveBeenCalledWith({ screen: 'schedule' });
    expect(within(card).getByText(tm.mcRequestRemoval)).toBeTruthy();
  });

  it('phone: tapping a client opens the card as a sheet with Request removal', async () => {
    setViewport(390);
    configureSchedule(createFixturesSchedulePort());
    mount();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(within(list()).getByText('Oleh Bondar'));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText(tm.mcRequestRemoval)).toBeTruthy();
    expect(within(sheet).getByRole('button', { name: tm.mcOpenSchedule })).toBeTruthy();
    await waitFor(() => expect(within(sheet).getByText(tm.mcUpcoming)).toBeTruthy());
  });
});

describe('Invite a client and Request removal (SPO-202 AC 4-5)', () => {
  const teamPort = (sent: unknown[] = []) => ({
    ...createFixturesTeamPort({ viewer: 'manager' }),
    inviteClient: async (trainerId: string, name: string) => {
      sent.push([trainerId, name]);
      return { url: 'https://spotter.example/#/invite/x1' };
    },
  });

  it('the invite sheet has a Trainer choice (Segmented) with the team trainers and the chosen trainer goes out; no consent choice', async () => {
    const sent: unknown[] = [];
    render(
      <ManagerClientsScreen
        onNavigate={() => undefined}
        port={createStaticManagerClients(MANAGER_CLIENTS)}
        teamPort={teamPort(sent)}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: tm.icButton }));
    const dlg = await screen.findByRole('dialog');
    const group = within(dlg).getByRole('group', { name: tm.icTrainerLabel });
    expect(
      within(group)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Olena K.', 'Andriy P.']);
    expect(within(dlg).queryByText(/consent/i)).toBeNull();
    fireEvent.click(within(group).getByRole('button', { name: 'Andriy P.' }));
    fireEvent.change(within(dlg).getByRole('textbox'), { target: { value: 'Nina Test' } });
    fireEvent.click(within(dlg).getByRole('button', { name: tm.icCreate }));
    await screen.findByDisplayValue(/invite\/x1/);
    expect(sent).toEqual([['trainer-andriy', 'Nina Test']]);
  });

  it('Request removal is danger, names the trainer, lists the effects, and Keep sends nothing', async () => {
    const requestRemoval = vi.fn(async () => undefined);
    render(
      <ManagerClientsScreen
        onNavigate={() => undefined}
        port={createStaticManagerClients(MANAGER_CLIENTS)}
        teamPort={{ ...createFixturesTeamPort({ viewer: 'manager' }), requestRemoval }}
      />,
    );
    fireEvent.click(screen.getByText(tm.mcRequestRemoval));
    const dlg = await screen.findByRole('alertdialog');
    expect(within(dlg).getByText(tm.mcAskTitle('Andriy P.', 'Andriy'))).toBeTruthy();
    expect(within(dlg).getByText(tm.mcAskEffect1('Andriy P.'))).toBeTruthy();
    expect(within(dlg).getByText(tm.mcAskEffect2('Andriy'))).toBeTruthy();
    expect(within(dlg).getByText(tm.mcAskEffect3)).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: tm.mcAskKeep }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(requestRemoval).not.toHaveBeenCalled();
  });

  it('a failed send keeps the dialog and says so', async () => {
    const requestRemoval = vi.fn(async () => {
      throw new Error('x');
    });
    render(
      <ManagerClientsScreen
        onNavigate={() => undefined}
        port={createStaticManagerClients(MANAGER_CLIENTS)}
        teamPort={{ ...createFixturesTeamPort({ viewer: 'manager' }), requestRemoval }}
      />,
    );
    fireEvent.click(screen.getByText(tm.mcRequestRemoval));
    const dlg = await screen.findByRole('alertdialog');
    fireEvent.click(within(dlg).getByRole('button', { name: tm.mcAskSend }));
    expect(await within(dlg).findByText(tm.mcAskFailed)).toBeTruthy();
  });
});
