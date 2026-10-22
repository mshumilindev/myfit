import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { teamEn as tm } from '../../i18n/coachTeam.en';
import { setViewport } from '../testViewport';
import { createFixturesTeamPort } from './__fixtures__/fixtures';
import { SpotterScreen } from './SpotterScreen';
import { TeamRequestsSection } from './TeamRequestsSection';

afterEach(cleanup);
beforeEach(() => setViewport(1440));
const NOW = Date.UTC(2026, 9, 20, 12, 0);
const mount = (o = {}, nav = vi.fn()) =>
  render(
    <SpotterScreen onNavigate={nav} port={createFixturesTeamPort({ now: () => NOW, ...o })} />,
  );

describe('Spotter team messages', () => {
  it('trainer: a removal request with the reassurance, a manager proposal and a join', async () => {
    mount();
    expect(await screen.findByText(tm.spRemovalRequest('Irina M.', 'Sofiia Hnatiuk'))).toBeTruthy();
    expect(screen.getByText(new RegExp(tm.spRemovalNote))).toBeTruthy();
    expect(screen.getByText(tm.spManagerMove('Irina M.', 'Maria Tkach'))).toBeTruthy();
    expect(screen.getByText(tm.spTeamManager('Irina M.'))).toBeTruthy();
  });

  it('approving answers the request and the row shows the result', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: tm.spApprove }));
    expect(await screen.findByText(tm.spStatusApproved)).toBeTruthy();
    expect(screen.queryByRole('button', { name: tm.spApprove })).toBeNull();
  });

  it('approving in Spotter answers the very request the Agenda card shows: the card leaves there too', async () => {
    const port = createFixturesTeamPort({ now: () => NOW, withRequests: true });
    const answer = vi.spyOn(port, 'answerRequest');
    render(
      <>
        <TeamRequestsSection port={port} />
        <SpotterScreen onNavigate={vi.fn()} port={port} />
      </>,
    );
    expect(await screen.findByText(tm.trTitle('Irina', 'Sofiia'))).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: tm.spApprove }));
    await waitFor(() => expect(screen.queryByText(tm.trTitle('Irina', 'Sofiia'))).toBeNull());
    expect(answer).toHaveBeenCalledTimes(1);
    expect(answer).toHaveBeenCalledWith('rm-c4', true);
  });

  it('opening marks the messages read (the subtitle stops counting)', async () => {
    mount();
    expect(await screen.findByText(new RegExp(tm.spUnread(2)))).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(new RegExp(tm.spUnread(2)))).toBeNull());
  });

  it('manager: sees the answers, no buttons', async () => {
    mount({ viewer: 'manager' });
    expect(
      await screen.findByText(tm.spRemovalAnswerYes('Olena K.', 'Taras Rudenko')),
    ).toBeTruthy();
    expect(screen.getByText(tm.spRemovalAnswerNo('Olena K.', 'Bohdan Palamar'))).toBeTruthy();
    expect(screen.queryByRole('button', { name: tm.spApprove })).toBeNull();
  });

  it('a failed load offers Retry; Back goes to Team', async () => {
    const nav = vi.fn();
    let fail = true;
    mount({ failWith: () => (fail ? 'unavailable' : null) }, nav);
    expect(await screen.findByText(tm.spFailed)).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: tm.tmRetry }));
    expect(await screen.findByText(tm.spRemovalRequest('Irina M.', 'Sofiia Hnatiuk'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: tm.spBack }));
    expect(nav).toHaveBeenCalledWith({ screen: 'team' });
  });
});
