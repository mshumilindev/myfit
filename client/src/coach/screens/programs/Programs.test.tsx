import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { programsEn as pg } from '../../../i18n/coachPrograms.en';
import { createFixturesPort } from '../../data/__fixtures__/fixtures';
import type { CoachClient } from '../../domain/types';
import { setViewport } from '../../testViewport';
import { emptyRoster, worldPort } from '../storyPorts';
import { matchGroup, programGroups } from './model';
import { ProgramsScreen } from './ProgramsScreen';
import { safeEn } from '../../../i18n/coachSafe.en';

afterEach(cleanup);
beforeEach(() => setViewport(1440));

const c = (id: string, name: string, program: string, over: Partial<CoachClient> = {}) =>
  ({ id, name, program, trainerDays: [], programWeek: 1, ...over }) as unknown as CoachClient;

describe('programs model', () => {
  it('groups by program name, most followers first, skips pending invites', () => {
    const g = programGroups([
      c('1', 'Zed', 'Solo A'),
      c('2', 'Yulia', 'Hybrid 4x'),
      c('3', 'Andriy', 'Hybrid 4x'),
      c('4', 'Pending', 'Hybrid 4x', { invite: { sentAt: 1, expiresAt: 2 } }),
    ]);
    expect(g.map((x) => [x.name, x.clients.map((y) => y.name)])).toEqual([
      ['Hybrid 4x', ['Andriy', 'Yulia']],
      ['Solo A', ['Zed']],
    ]);
  });
  it('matches the program name or a follower, ignoring case and accents', () => {
    const [g] = programGroups([c('1', 'Łukasz', 'Upper/Lower 4x')]);
    expect(matchGroup(g, 'lower')).toBe(true);
    expect(matchGroup(g, 'lukasz')).toBe(true);
    expect(matchGroup(g, 'xyz')).toBe(false);
  });
});

describe('Programs screen', () => {
  const mount = (over: Partial<Parameters<typeof ProgramsScreen>[0]> = {}) => {
    const onNavigate = vi.fn();
    render(
      <ProgramsScreen
        onNavigate={onNavigate}
        port={worldPort(undefined, { warm: true })}
        {...over}
      />,
    );
    return { onNavigate };
  };

  it('lists programs with followers; the first is open with its clients and the primary action', async () => {
    const { onNavigate } = mount();
    const list = await screen.findByRole('list', { name: pg.pgListLabel });
    expect(within(list).getAllByRole('button').length).toBeGreaterThan(5);
    const clients = await screen.findByRole('list', { name: pg.pgClientsLabel });
    expect(within(clients).getAllByRole('button').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: pg.pgOpenEditor }));
    expect(onNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        screen: 'programs',
        sub: 'edit',
        programId: expect.stringMatching(/^prg-/),
      }),
    );
  });

  it('selecting another program swaps the detail; the search narrows the list', async () => {
    mount();
    const list = await screen.findByRole('list', { name: pg.pgListLabel });
    const rows = within(list).getAllByRole('button');
    fireEvent.click(rows[rows.length - 1]);
    expect(rows[rows.length - 1].getAttribute('aria-current')).toBe('true');
    fireEvent.change(screen.getByRole('searchbox', { name: pg.pgSearch }), {
      target: { value: 'zzzz' },
    });
    expect(await screen.findByText(pg.pgNoMatchH)).toBeTruthy();
  });

  it('empty roster: empty state with New program; failure offers Try again', async () => {
    mount({ port: worldPort(emptyRoster, { warm: true }) });
    expect(await screen.findByText(pg.pgNoneH)).toBeTruthy();
    cleanup();
    let fail = true;
    mount({ port: createFixturesPort({ failWith: () => (fail ? 'unavailable' : null) }) });
    expect(await screen.findByText(safeEn.pbUnknownTitle)).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: pg.pgRetry }));
    await waitFor(() => screen.getByRole('list', { name: pg.pgListLabel }));
  });

  it('New program asks for the client, then opens that client in the editor', async () => {
    const { onNavigate } = mount();
    await screen.findByRole('list', { name: pg.pgListLabel });
    fireEvent.click(screen.getByRole('button', { name: pg.pgNew }));
    const picker = await screen.findByRole('list', { name: pg.pgNewLabel });
    fireEvent.click(within(picker).getAllByRole('button')[0]);
    expect(onNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ screen: 'programs', sub: 'edit' }),
    );
  });

  it('phone: the list is the screen and a program is pushed with Back', async () => {
    setViewport(390);
    mount();
    const list = await screen.findByRole('list', { name: pg.pgListLabel });
    expect(screen.queryByRole('button', { name: pg.pgOpenEditor })).toBeNull();
    fireEvent.click(within(list).getAllByRole('button')[0]);
    expect(await screen.findByRole('button', { name: pg.pgOpenEditor })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: pg.pgBack }));
    expect(await screen.findByRole('list', { name: pg.pgListLabel })).toBeTruthy();
  });
});
