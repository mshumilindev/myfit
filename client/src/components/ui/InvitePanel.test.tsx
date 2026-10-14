import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InvitePanel, type InviteCreated, type InviteLabels } from './InvitePanel';

afterEach(cleanup);

const LABELS: InviteLabels = {
  title: 'Invite a client',
  modeGroup: 'How the client logs',
  modes: {
    app: { label: 'App', hint: 'hint-app', submit: 'Send app invite' },
    hybrid: { label: 'Hybrid', hint: 'hint-hybrid', submit: 'Send invite' },
    program: { label: 'Program only', hint: 'hint-program', submit: 'Create program-only client' },
  },
  nameLabel: 'Name',
  namePlaceholder: 'For example, Olena Marchenko',
  nameNeeded: "Enter the client's name to continue.",
  nameTooShort: 'Use at least 2 characters.',
  consentToggleShow: 'Choose what you would like to see',
  consentToggleHide: 'Hide sharing request',
  consentLegend: 'What you would like the client to share',
  consentNote: 'This is a request.',
  levels: { off: 'Off', effects: 'Effects only', full: 'Full' },
  categories: [
    { id: 'totals', label: 'Workout totals' },
    { id: 'sets', label: 'Sets and weights' },
  ],
  sending: 'Sending...',
  errorOffline: 'You are offline.',
  errorFailed: 'Not created.',
  sent: { app: 'sent-app', hybrid: 'sent-hybrid', program: 'sent-program' },
  linkLabel: 'Invite link',
  copy: 'Copy link',
  copied: 'Copied',
  share: 'Share',
  sendInChat: 'Send in chat',
  expires: (d) => `works ${d} days`,
  another: 'Invite another',
  openProfile: 'Open profile',
};
const defaults = (m: string): Record<string, 'off' | 'effects' | 'full'> =>
  m === 'program' ? {} : { totals: 'full' };
const ok = (over: Partial<InviteCreated> = {}) =>
  vi.fn(async (req: { name: string; mode: string; request: Record<string, string> }) => {
    void req;
    return {
      id: 'i1',
      url: 'https://spotter.app/i/abc' as string | null,
      expiresInDays: 7 as number | null,
      ...over,
    };
  });

const setup = (onCreate = ok(), extra: Partial<Parameters<typeof InvitePanel>[0]> = {}) => {
  render(
    <InvitePanel
      labels={LABELS}
      defaultRequest={defaults}
      onCreate={onCreate as never}
      {...extra}
    />,
  );
  return onCreate;
};
const type = (v: string) =>
  fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: v } });

describe('InvitePanel', () => {
  it('is disabled until there is a name (2+ characters) and explains why', () => {
    setup();
    const submit = screen.getByRole('button', { name: 'Send app invite' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(screen.getByText("Enter the client's name to continue.")).toBeTruthy();
    type('A');
    expect(submit.disabled).toBe(true);
    expect(screen.getByText('Use at least 2 characters.')).toBeTruthy();
    type('Olena');
    expect(submit.disabled).toBe(false);
  });

  it('three modes: hint and button follow the mode', () => {
    setup();
    const group = screen.getByRole('group', { name: 'How the client logs' });
    expect(
      within(group)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['App', 'Hybrid', 'Program only']);
    expect(screen.getByText('hint-app')).toBeTruthy();
    fireEvent.click(within(group).getByRole('button', { name: 'Hybrid' }));
    expect(screen.getByText('hint-hybrid')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send invite' })).toBeTruthy();
    fireEvent.click(within(group).getByRole('button', { name: 'Program only' }));
    expect(screen.getByRole('button', { name: 'Create program-only client' })).toBeTruthy();
  });

  it('sends name, mode and the default request; shows link, copy and expiry', async () => {
    const onCreate = setup();
    type('  Olena Marchenko ');
    fireEvent.click(screen.getByRole('button', { name: 'Send app invite' }));
    await waitFor(() => expect(screen.getByText('sent-app')).toBeTruthy());
    expect(onCreate).toHaveBeenCalledWith({
      name: 'Olena Marchenko',
      mode: 'app',
      request: { totals: 'full' },
    });
    expect((screen.getByLabelText('Invite link') as HTMLInputElement).value).toBe(
      'https://spotter.app/i/abc',
    );
    expect(screen.getByText('works 7 days')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy();
  });

  it('the consent picker is a request: opens on demand, changes what is sent, absent for program-only', async () => {
    const onCreate = setup();
    expect(screen.queryByRole('group', { name: 'Sets and weights' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Choose what you would like to see' }));
    const sets = screen.getByRole('group', { name: 'Sets and weights' });
    expect(
      within(sets)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Off', 'Effects only', 'Full']);
    fireEvent.click(within(sets).getByRole('button', { name: 'Effects only' }));
    type('Olena');
    fireEvent.click(screen.getByRole('button', { name: 'Send app invite' }));
    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    expect(onCreate.mock.calls[0][0].request).toEqual({ totals: 'full', sets: 'effects' });
    fireEvent.click(await screen.findByRole('button', { name: 'Invite another' }));
    fireEvent.click(screen.getByRole('button', { name: 'Program only' }));
    expect(screen.queryByRole('button', { name: 'Choose what you would like to see' })).toBeNull();
  });

  it('program-only sends an empty request and shows no link', async () => {
    const onCreate = setup(ok({ url: null, expiresInDays: null }), {
      initialMode: 'program',
      onOpenProfile: vi.fn(),
    });
    type('Dmytro');
    fireEvent.click(screen.getByRole('button', { name: 'Create program-only client' }));
    await waitFor(() => expect(screen.getByText('sent-program')).toBeTruthy());
    expect(onCreate.mock.calls[0][0]).toMatchObject({ mode: 'program', request: {} });
    expect(screen.queryByLabelText('Invite link')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open profile' })).toBeTruthy();
  });

  it('offline and failed errors keep the typed name and the form', async () => {
    const offline = vi.fn(async () => {
      throw Object.assign(new Error('x'), { code: 'offline' });
    });
    setup(offline as never);
    type('Olena');
    fireEvent.click(screen.getByRole('button', { name: 'Send app invite' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('You are offline.'),
    );
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe('Olena');
    cleanup();
    setup(
      vi.fn(async () => {
        throw new Error('boom');
      }) as never,
    );
    type('Olena');
    fireEvent.click(screen.getByRole('button', { name: 'Send app invite' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Not created.'));
  });

  it('copy writes the link to the clipboard and says Copied; chat button hands the link over', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const onChat = vi.fn();
    setup(ok(), { onSendInChat: onChat });
    type('Olena');
    fireEvent.click(screen.getByRole('button', { name: 'Send app invite' }));
    await waitFor(() => screen.getByRole('button', { name: 'Copy link' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith('https://spotter.app/i/abc');
    fireEvent.click(screen.getByRole('button', { name: 'Send in chat' }));
    expect(onChat).toHaveBeenCalledWith('https://spotter.app/i/abc');
  });
});
