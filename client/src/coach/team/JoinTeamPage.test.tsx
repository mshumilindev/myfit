import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { teamEn as tm } from '../../i18n/coachTeam.en';
import { createFixturesTeamPort, type FixturesTeamOptions } from './__fixtures__/fixtures';
import { JoinTeamPage } from './JoinTeamPage';

afterEach(cleanup);
const NOW = Date.UTC(2026, 9, 20, 9, 0);
const mount = (o: FixturesTeamOptions = {}, onExit = vi.fn()) => {
  render(
    <JoinTeamPage
      token="tok"
      port={createFixturesTeamPort({ now: () => NOW, ...o })}
      onExit={onExit}
    />,
  );
  return onExit;
};

describe('Join the team', () => {
  it('manager invite: names the inviter, says what the role cannot see, joins', async () => {
    mount();
    expect(
      await screen.findByRole('heading', { level: 1, name: tm.jtTitle('Olena') }),
    ).toBeTruthy();
    expect(screen.getByText(tm.jtBodyManager('Olena'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(tm.jtJoinManager) }));
    expect(await screen.findByText(tm.jtJoinedTitle)).toBeTruthy();
  });

  it('trainer invite says the manager sees only the schedule', async () => {
    mount({ invite: { role: 'trainer' } });
    expect(await screen.findByText(tm.jtBodyTrainer('Olena'))).toBeTruthy();
    expect(screen.getByRole('button', { name: new RegExp(tm.jtJoinTrainer) })).toBeTruthy();
  });

  it('decline is one tap and changes nothing else', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: tm.jtDecline }));
    expect(await screen.findByText(tm.jtDeclinedTitle)).toBeTruthy();
  });

  it('a closed link is a plain page with no Join button', async () => {
    mount({ invite: { closed: true } });
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText(tm.jtClosedTitle)).toBeTruthy();
    expect(screen.queryByRole('button', { name: new RegExp(tm.jtJoinManager) })).toBeNull();
  });

  it('an account that cannot be a manager gets the reason and can still decline', async () => {
    mount({ invite: { notEligible: true } });
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(tm.jtJoinManager) }));
    expect(await screen.findByText(tm.jtNotEligible)).toBeTruthy();
    expect(screen.getByRole('button', { name: tm.jtDecline })).toBeTruthy();
  });

  it('offline: Try again recovers', async () => {
    let off = true;
    mount({ failWith: () => (off ? 'offline' : null) });
    expect(await screen.findByText(tm.jtOfflineTitle)).toBeTruthy();
    off = false;
    fireEvent.click(screen.getByRole('button', { name: tm.jtRetry }));
    await waitFor(() => expect(screen.getByText(tm.jtDecline)).toBeTruthy());
  });

  it('Done leaves the page', async () => {
    const exit = mount({ invite: { closed: true } });
    fireEvent.click(await screen.findByRole('button', { name: tm.jtOk }));
    expect(exit).toHaveBeenCalled();
  });
});
