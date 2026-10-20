import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { teamEn as tm } from '../../i18n/coachTeam.en';
import { createFixturesTeamPort } from './__fixtures__/fixtures';
import { TeamRequestsSection } from './TeamRequestsSection';

afterEach(cleanup);
const NOW = Date.UTC(2026, 9, 20, 9, 0);

describe('Team requests (Agenda)', () => {
  it('shows nothing without requests', async () => {
    const { container } = render(
      <TeamRequestsSection port={createFixturesTeamPort({ now: () => NOW })} />,
    );
    await Promise.resolve();
    expect(container.textContent).toBe('');
  });

  it('shows the manager, the client and the reason; approve asks first, then the request leaves', async () => {
    render(
      <TeamRequestsSection port={createFixturesTeamPort({ now: () => NOW, withRequests: true })} />,
    );
    expect(await screen.findByText(tm.trTitle('Irina', 'Sofiia'))).toBeTruthy();
    expect(screen.getByText(/Moved to another city/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: tm.trApproveFor('Sofiia') }));
    const dlg = await screen.findByRole('alertdialog');
    expect(dlg.textContent).toContain(tm.trConfirmTitle('Sofiia'));
    fireEvent.click(screen.getByRole('button', { name: tm.trConfirm }));
    await waitFor(() => expect(screen.queryByText(tm.trTitle('Irina', 'Sofiia'))).toBeNull());
  });

  it('decline answers at once; a failing answer keeps the card and says so', async () => {
    const port = createFixturesTeamPort({ now: () => NOW, withRequests: true });
    const fail = { ...port, answerRequest: () => Promise.reject(new Error('x')) };
    render(<TeamRequestsSection port={fail} />);
    fireEvent.click(await screen.findByRole('button', { name: tm.trDeclineFor('Sofiia') }));
    expect(await screen.findByText(tm.trFailed)).toBeTruthy();
    expect(screen.getByText(tm.trTitle('Irina', 'Sofiia'))).toBeTruthy();
    cleanup();
    render(<TeamRequestsSection port={port} />);
    fireEvent.click(await screen.findByRole('button', { name: tm.trDeclineFor('Sofiia') }));
    await waitFor(() => expect(screen.queryByText(tm.trTitle('Irina', 'Sofiia'))).toBeNull());
  });
});
