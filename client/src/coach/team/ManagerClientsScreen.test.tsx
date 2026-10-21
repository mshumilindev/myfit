import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { teamEn as tm } from '../../i18n/coachTeam.en';
import { setViewport } from '../testViewport';
import { MANAGER_CLIENTS } from './__fixtures__/managerClients';
import { createFixturesTeamPort } from './__fixtures__/fixtures';
import { createStaticManagerClients, createUnavailableManagerClients } from './managerClients';
import { ManagerClientsScreen } from './ManagerClientsScreen';

afterEach(cleanup);
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
