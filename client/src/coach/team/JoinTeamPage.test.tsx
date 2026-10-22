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
// the landing draws the hero card twice (wide and narrow layout): the first copy is enough
const text = async (t: string) => (await screen.findAllByText(t))[0];
const button = async (name: string | RegExp) => (await screen.findAllByRole('button', { name }))[0];

describe('Join the team (inside the landing)', () => {
  it('manager invite: names the inviter, says what the role cannot see, joins', async () => {
    mount();
    expect(await text(tm.jtTitle('Olena'))).toBeTruthy();
    expect(await text(tm.jtBodyManager('Olena'))).toBeTruthy();
    fireEvent.click(await button(tm.jtJoinManager));
    expect(await text(tm.jtJoinedTitle)).toBeTruthy();
  });

  it('trainer invite says the manager sees only the schedule', async () => {
    mount({ invite: { role: 'trainer' } });
    expect(await text(tm.jtBodyTrainer('Olena'))).toBeTruthy();
    expect(await button(tm.jtJoinTrainer)).toBeTruthy();
  });

  it('decline is one tap and changes nothing else', async () => {
    mount();
    fireEvent.click(await button(tm.jtDecline));
    expect(await text(tm.jtDeclinedTitle)).toBeTruthy();
  });

  it('a closed link says so and offers no Join', async () => {
    mount({ invite: { closed: true } });
    expect(await text(tm.jtClosedTitle)).toBeTruthy();
    expect(screen.queryAllByRole('button', { name: tm.jtJoinManager })).toHaveLength(0);
  });

  it('an account that cannot be a manager gets the reason and can still decline', async () => {
    mount({ invite: { notEligible: true } });
    fireEvent.click(await button(tm.jtJoinManager));
    expect((await screen.findAllByRole('alert'))[0].textContent).toBe(tm.jtNotEligible);
    expect(await button(tm.jtDecline)).toBeTruthy();
  });

  it('offline: Try again recovers', async () => {
    let off = true;
    mount({ failWith: () => (off ? 'offline' : null) });
    expect(await text(tm.jtOfflineTitle)).toBeTruthy();
    off = false;
    fireEvent.click(await button(tm.jtRetry));
    await waitFor(() => expect(screen.getAllByText(tm.jtDecline).length).toBeGreaterThan(0));
  });

  it('Done leaves the page', async () => {
    const exit = mount({ invite: { closed: true } });
    fireEvent.click(await button(tm.jtOk));
    expect(exit).toHaveBeenCalled();
  });
});
