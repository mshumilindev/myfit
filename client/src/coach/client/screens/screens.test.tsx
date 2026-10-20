import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clientEn as t } from '../../../i18n/coachClient.en';
import { safeEn as sf } from '../../../i18n/coachSafe.en';
import { MyTrainerPage } from './MyTrainerPage';
import type { ClientCoachPort } from '../data/port';
import { setViewport } from '../../testViewport';
import { createFixturesClientPort } from '../data/__fixtures__/fixtures';
import { InvitePages } from './InvitePages';
import { TrainerSharing } from './TrainerSharing';
import { AccessLogPage } from './AccessLogPage';

beforeEach(() => setViewport(390));
afterEach(cleanup);

describe('invite pages', () => {
  it('landing -> share -> connected; nothing is written before Save', async () => {
    const port = createFixturesClientPort();
    const onExit = vi.fn();
    render(<InvitePages token="ok1" port={port} onExit={onExit} />);
    fireEvent.click(await screen.findByRole('button', { name: t.invAccept }));
    expect(port.state().link.state).toBe('none');
    fireEvent.click(await screen.findByRole('button', { name: t.invSave }));
    await waitFor(() => expect(port.state().link.state).toBe('waiting'));
    fireEvent.click(await screen.findByRole('button', { name: t.invGoToday }));
    expect(onExit).toHaveBeenCalledWith('today');
  });

  it('Share nothing for now saves everything Off', async () => {
    const port = createFixturesClientPort();
    render(<InvitePages token="ok2" port={port} onExit={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: t.invAccept }));
    fireEvent.click(await screen.findByRole('button', { name: t.invNothing }));
    await waitFor(() => expect(port.state().link.state).toBe('waiting'));
    expect(Object.values(port.state().link.grants).every((l) => l === 'off')).toBe(true);
  });

  it('expired and used invites explain themselves and share nothing', async () => {
    const port = createFixturesClientPort();
    render(<InvitePages token="expired1" port={port} onExit={() => undefined} />);
    expect(await screen.findByText(t.invExpTitle)).toBeTruthy();
    cleanup();
    render(<InvitePages token="used1" port={port} onExit={() => undefined} />);
    expect(await screen.findByText(t.invUsedTitle)).toBeTruthy();
    expect(port.state().link.state).toBe('none');
  });

  it('offline shows a calm retry page', async () => {
    const port = createFixturesClientPort({ fail: 'offline' });
    render(<InvitePages token="ok3" port={port} onExit={() => undefined} />);
    expect(await screen.findByText(t.invOfflineTitle)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.ccRetry })).toBeTruthy();
  });
});

describe('trainer sharing block', () => {
  it('renders nothing without a trainer', async () => {
    const port = createFixturesClientPort({ scenario: 'none' });
    const { container } = render(<TrainerSharing port={port} force />);
    await waitFor(() => expect(container.textContent).toBe(''));
  });

  it('active: stop sharing asks first, then offers Undo', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    render(<TrainerSharing port={port} force />);
    fireEvent.click(await screen.findByRole('button', { name: t.shStop('Iryna') }));
    fireEvent.click(await screen.findByRole('button', { name: t.shStopConfirm }));
    await waitFor(() => expect(port.state().link.state).toBe('revoked'));
    fireEvent.click(await screen.findByRole('button', { name: t.ccUndo }));
    await waitFor(() => expect(port.state().link.state).toBe('active'));
  });

  it('waiting says the trainer app has to turn sharing on', async () => {
    const port = createFixturesClientPort({ scenario: 'waiting' });
    render(<TrainerSharing port={port} force />);
    expect(await screen.findByText(t.shWaitingNote('Iryna'))).toBeTruthy();
  });
});

describe('access log', () => {
  it('lists what the trainer opened', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    render(<AccessLogPage port={port} onBack={() => undefined} />);
    expect(await screen.findByText(t.lgTitle)).toBeTruthy();
    expect((await screen.findAllByText(t.lgSummary)).length).toBeGreaterThan(0);
  });
  it('a failing load says so with Try again', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    port.accessLog = () => Promise.reject(new Error('x'));
    render(<AccessLogPage port={port} onBack={() => undefined} />);
    expect(await screen.findByText(t.lgFailed)).toBeTruthy();
  });
});

describe('My trainer page states (audit C-01: no eternal skeleton)', () => {
  const noop = () => undefined;
  const page = (port: ClientCoachPort) =>
    render(
      <MyTrainerPage
        port={port}
        onBack={noop}
        onChat={noop}
        onSharing={noop}
        onProgram={noop}
        onLeft={noop}
      />,
    );
  it('a legacy trainer adopted into the new model: a clear note, nothing shared yet, and a way to choose', async () => {
    const onSharing = vi.fn();
    render(
      <MyTrainerPage
        port={createFixturesClientPort({ scenario: 'migrated' })}
        onBack={noop}
        onChat={noop}
        onSharing={onSharing}
        onProgram={noop}
        onLeft={noop}
      />,
    );
    expect(await screen.findByText(t.mtMigratedNote('Iryna'))).toBeTruthy();
    const buttons = screen.getAllByRole('button', { name: t.mtSharing });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onSharing).toHaveBeenCalled();
  });
  it('an ordinary relationship shows no migration note', async () => {
    page(createFixturesClientPort({ scenario: 'active' }));
    await screen.findByText(t.mtChat);
    expect(screen.queryByText(t.mtMigratedNote('Iryna'))).toBeNull();
  });
  it('no trainer: an empty state with a way out, not a skeleton', async () => {
    const onBack = vi.fn();
    render(
      <MyTrainerPage
        port={createFixturesClientPort({ scenario: 'none' })}
        onBack={onBack}
        onChat={noop}
        onSharing={noop}
        onProgram={noop}
        onLeft={noop}
      />,
    );
    expect(await screen.findByText(sf.mtNoneTitle)).toBeTruthy();
    expect(screen.queryByRole('status', { name: t.ccLoading })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: sf.mtNoneCta }));
    expect(onBack).toHaveBeenCalled();
  });
  it('a failing subscription shows a FailedState with Retry', async () => {
    const base = createFixturesClientPort({ scenario: 'active' });
    let attempts = 0;
    const port: ClientCoachPort = {
      ...base,
      peek: () => null,
      subscribe: (on, onError) => {
        attempts += 1;
        if (attempts === 1) {
          queueMicrotask(() => onError(new Error('offline')));
          return () => undefined;
        }
        return base.subscribe(on, onError);
      },
    };
    page(port);
    expect(await screen.findByText(sf.pbUnknownTitle)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: sf.retry }));
    expect(await screen.findByText(t.mtChat)).toBeTruthy();
    expect(attempts).toBe(2);
  });
  it('while loading it is a skeleton', () => {
    const base = createFixturesClientPort({ scenario: 'active' });
    page({ ...base, peek: () => null, subscribe: () => () => undefined });
    expect(screen.getByRole('status', { name: t.ccLoading })).toBeTruthy();
  });
});

describe('My trainer: leaving asks for the password (plan 2.7)', () => {
  it('confirm, then the password, then the relationship ends', async () => {
    const { configureReauth, forgetReauth } = await import('../../security/reauth');
    const { createFixturesReauthPort } = await import('../../security/__fixtures__/reauth');
    forgetReauth();
    configureReauth(createFixturesReauthPort({ accept: 'secret' }));
    const port = createFixturesClientPort({ scenario: 'active' });
    const leave = vi.spyOn(port, 'leave');
    const onLeft = vi.fn();
    render(
      <MyTrainerPage
        port={port}
        onBack={() => undefined}
        onChat={() => undefined}
        onSharing={() => undefined}
        onProgram={() => undefined}
        onLeft={onLeft}
      />,
    );
    fireEvent.click(await screen.findByText(t.mtLeave));
    fireEvent.click(screen.getByRole('button', { name: t.mtLeaveConfirm }));
    expect(leave).not.toHaveBeenCalled();
    fireEvent.change(await screen.findByLabelText(/Password/), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: sf.raConfirm }));
    await waitFor(() => expect(leave).toHaveBeenCalled());
    await waitFor(() => expect(onLeft).toHaveBeenCalled());
    configureReauth(null);
    forgetReauth();
  });
});

describe("the trainer's team (SPO-205)", () => {
  it('My trainer offers the team row; the page lists the people and what managers did, and says what they cannot see', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    render(
      <MyTrainerPage
        port={port}
        onBack={() => undefined}
        onChat={() => undefined}
        onSharing={() => undefined}
        onProgram={() => undefined}
        onLeft={() => undefined}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(t.mtTeamRow) }));
    expect((await screen.findAllByText('Irina Melnyk')).length).toBeGreaterThan(1);
    expect(screen.getByText(t.tmgRoleManager)).toBeTruthy();
    expect(screen.getByText(t.tmgKind['move-request']!)).toBeTruthy();
    expect(screen.getByText(new RegExp(t.tmgCannot))).toBeTruthy();
  });

  it('Who saw your data also lists what managers did with the schedule', async () => {
    render(
      <AccessLogPage
        port={createFixturesClientPort({ scenario: 'active' })}
        onBack={() => undefined}
      />,
    );
    expect(await screen.findByText(t.tmgActionsHead)).toBeTruthy();
    expect(screen.getByText(t.tmgKind['session-done']!)).toBeTruthy();
  });
});
