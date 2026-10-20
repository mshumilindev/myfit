import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { teamEn as tm } from '../../i18n/coachTeam.en';
import { setViewport } from '../testViewport';
import { MANAGER_CLIENTS } from './__fixtures__/managerClients';
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
    expect(screen.getByText(tm.mcSub(14, 11))).toBeTruthy();
    expect(screen.getByText(tm.mcPending(3))).toBeTruthy();
  });

  it('a client without delegated keys waits; the others show their next session', () => {
    mount();
    const list = screen.getByRole('list', { name: tm.mcListLabel });
    const row = within(list).getByText('Taras Rudenko').closest('li')!;
    expect(row.textContent).toContain(tm.mcWaiting);
    expect(within(list).getAllByText(tm.mcWaiting)).toHaveLength(3);
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
});
