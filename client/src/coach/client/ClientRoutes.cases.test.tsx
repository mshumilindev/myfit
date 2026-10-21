/** The member's trainer overlay: which page each route opens, the gates (switched off, trainer account, unknown route) and the exits. */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clientEn as cc } from '../../i18n/coachClient.en';
import { chatEn } from '../../i18n/coachChat.en';
import { safeEn as sf } from '../../i18n/coachSafe.en';
import { setRole } from '../../api';
import { setCoachBackendMode } from '../__fixtures__/register';
import { setViewport } from '../testViewport';
import { createFixturesClientChatPort } from './data/__fixtures__/chat';
import { createFixturesClientPort, type ClientScenario } from './data/__fixtures__/fixtures';
import { configureClientCoach } from './data/config';
import ClientRoutes from './ClientRoutes';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('../../navigateHash', () => ({ navigateHash: navigate }));

beforeEach(() => {
  setViewport(390);
  navigate.mockClear();
  setRole('member');
});
afterEach(() => {
  cleanup();
  configureClientCoach();
  setCoachBackendMode(null);
  setRole('member');
});

const link = (scenario: ClientScenario) =>
  configureClientCoach({
    port: createFixturesClientPort({ scenario }),
    chat: createFixturesClientChatPort({ unread: 0 }),
  });

describe('gates', () => {
  it('a build with Coach switched off explains it and offers the way back; nothing of the client is rendered', async () => {
    setCoachBackendMode('unconfigured');
    const onClose = vi.fn();
    render(<ClientRoutes route="trainer" onClose={onClose} />);
    expect(await screen.findByTestId('coach-not-configured')).toBeTruthy();
    expect(screen.getByText(sf.offTitle)).toBeTruthy();
    expect(screen.queryByRole('button', { name: sf.offBack })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: cc.ccBack })[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Iryna Melnyk')).toBeNull();
  });

  it('a route that is not ours closes the overlay and renders nothing (an unconfigured build shows the notice instead)', async () => {
    link('active');
    const onClose = vi.fn();
    const { container } = render(<ClientRoutes route="trainer/unknown" onClose={onClose} />);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(container.textContent).toBe('');
    cleanup();
    onClose.mockClear();
    render(<ClientRoutes route="invite/bad token!" onClose={onClose} />);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("a trainer's own account never sees the member pages: the overlay closes", async () => {
    setRole('trainer');
    link('active');
    const onClose = vi.fn();
    const { container } = render(<ClientRoutes route="trainer" onClose={onClose} />);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });

  it('with Coach switched off a trainer account is also closed out, not shown the notice', async () => {
    setRole('trainer');
    setCoachBackendMode('unconfigured');
    const onClose = vi.fn();
    render(<ClientRoutes route="trainer" onClose={onClose} />);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(screen.queryByTestId('coach-not-configured')).toBeNull();
  });
});

describe('pages', () => {
  it('#/trainer opens My trainer; its actions navigate to chat, sharing settings and the program', async () => {
    link('active');
    render(<ClientRoutes route="trainer" onClose={() => undefined} />);
    expect(await screen.findByText(cc.mtTitle)).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: cc.mtChat }));
    expect(navigate).toHaveBeenLastCalledWith('#/trainer/chat');
    fireEvent.click(screen.getAllByRole('button', { name: cc.mtSharing })[0]);
    expect(navigate).toHaveBeenLastCalledWith('#/health/privacy');
  });

  it('#/trainer/spotter (the push deep link) opens the pinned Spotter thread, read-only; Back closes it', async () => {
    link('active');
    const onClose = vi.fn();
    render(<ClientRoutes route="trainer/spotter" onClose={onClose} />);
    expect(await screen.findByText(cc.spTitle)).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: cc.ccBack })[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('leaving the trainer sends the member back to Today', async () => {
    const { configureReauth, forgetReauth } = await import('../security/reauth');
    const { createFixturesReauthPort } = await import('../security/__fixtures__/reauth');
    forgetReauth();
    configureReauth(createFixturesReauthPort({ accept: 'secret' }));
    link('active');
    render(<ClientRoutes route="trainer" onClose={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: cc.mtLeave }));
    fireEvent.click(await screen.findByRole('button', { name: cc.mtLeaveConfirm }));
    expect(navigate).not.toHaveBeenCalledWith('#/today');
    fireEvent.change(await screen.findByLabelText(/Password/), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: sf.raConfirm }));
    await waitFor(() => expect(navigate).toHaveBeenLastCalledWith('#/today'));
    configureReauth(null);
    forgetReauth();
  });

  it('#/trainer without a trainer link is the "No trainer yet" page', async () => {
    link('none');
    const onClose = vi.fn();
    render(<ClientRoutes route="trainer" onClose={onClose} />);
    expect(await screen.findByText(sf.mtNoneTitle)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: sf.mtNoneCta }));
    expect(onClose).toHaveBeenCalled();
  });

  it('#/trainer/log opens the access log with a Back that closes', async () => {
    link('active');
    const onClose = vi.fn();
    render(<ClientRoutes route="trainer/log" onClose={onClose} />);
    expect(await screen.findByText(cc.lgTitle)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: cc.ccBack }));
    expect(onClose).toHaveBeenCalled();
  });

  it('#/trainer/chat with a trainer opens the chat; its links go to the trainer page, the program and sharing', async () => {
    link('active');
    render(<ClientRoutes route="trainer/chat" onClose={() => undefined} />);
    expect(await screen.findByRole('log')).toBeTruthy();
  });

  it('#/invite/<token> opens the invite; Today / chat / sharing exits navigate', async () => {
    link('none');
    render(<ClientRoutes route="invite/ok1" onClose={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: cc.invAccept }));
    fireEvent.click(await screen.findByRole('button', { name: cc.invNothing }));
    fireEvent.click(await screen.findByRole('button', { name: cc.invGoToday }));
    expect(navigate).toHaveBeenLastCalledWith('#/today');
  });

  it('after accepting, "Message" goes to the trainer chat and "Change" to the sharing settings', async () => {
    link('none');
    render(<ClientRoutes route="invite/ok2" onClose={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: cc.invAccept }));
    fireEvent.click(await screen.findByRole('button', { name: cc.invSave }));
    fireEvent.click(await screen.findByRole('button', { name: cc.invMessage('Iryna') }));
    expect(navigate).toHaveBeenLastCalledWith('#/trainer/chat');
    fireEvent.click(screen.getByRole('button', { name: cc.invChange }));
    expect(navigate).toHaveBeenLastCalledWith('#/health/privacy');
  });

  it('the chat page links to what the trainer sees, to the trainer page', async () => {
    link('active');
    render(<ClientRoutes route="trainer/chat" onClose={() => undefined} />);
    await screen.findByRole('log');
    fireEvent.click(screen.getByRole('button', { name: cc.chSeesBtn('Iryna') }));
    expect(navigate).toHaveBeenLastCalledWith('#/health/privacy');
    fireEvent.click(screen.getByRole('button', { name: chatEn.chMenuChat }));
    fireEvent.click(await screen.findByRole('menuitem', { name: cc.chMenuTrainer }));
    expect(navigate).toHaveBeenLastCalledWith('#/trainer');
  });

  it('the program card in the thread and the program row on the trainer page both open the programs', async () => {
    link('active');
    const chatView = render(<ClientRoutes route="trainer/chat" onClose={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: cc.chOpenProgram }));
    expect(navigate).toHaveBeenLastCalledWith('#/programs');
    chatView.unmount();
    navigate.mockClear();
    render(<ClientRoutes route="trainer" onClose={() => undefined} />);
    fireEvent.click(await screen.findByText(new RegExp(cc.mtProgramSub('v')), { selector: '*' }));
    expect(navigate).toHaveBeenLastCalledWith('#/programs');
  });

  it('an expired invite leaves nothing shared and still offers a way out', async () => {
    link('none');
    render(<ClientRoutes route="invite/expired1" onClose={() => undefined} />);
    expect(await screen.findByText(cc.invExpTitle)).toBeTruthy();
  });
});
