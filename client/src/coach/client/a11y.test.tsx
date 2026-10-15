import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clientEn as t } from '../../i18n/coachClient.en';
import { setViewport } from '../testViewport';
import { SharePicker } from '../share/SharePicker';
import { ClientTrainerDayTag } from './ClientExtras';
import { configureClientCoach } from './data/config';
import { createFixturesClientChatPort } from './data/__fixtures__/chat';
import { createFixturesClientPort } from './data/__fixtures__/fixtures';
import { ClientChat } from './screens/ClientChat';

beforeEach(() => {
  setViewport(1440);
});
afterEach(() => {
  cleanup();
  configureClientCoach();
});

describe('share picker structure', () => {
  it('every listbox holds only options, the field controls existing listboxes, type chips are pressable toggles', async () => {
    render(
      <SharePicker
        open
        onClose={() => undefined}
        anchorRef={{ current: document.body }}
        viewer={{ side: 'trainer', clientId: 'c1' }}
        who="Oleh"
        onPick={() => undefined}
        initialQuery="a"
      />,
    );
    await waitFor(() =>
      expect(document.querySelectorAll('[role="listbox"]').length).toBeGreaterThan(0),
    );
    for (const lb of document.querySelectorAll('[role="listbox"]')) {
      expect(lb.getAttribute('aria-label')).toBeTruthy();
      for (const child of lb.children) expect(child.getAttribute('role')).toBe('option');
    }
    const combo = screen.getByRole('combobox');
    for (const id of (combo.getAttribute('aria-controls') ?? '').split(' ')) {
      expect(document.getElementById(id)).toBeTruthy();
    }
    const chips = within(screen.getByRole('group')).getAllByRole('button');
    expect(chips.length).toBeGreaterThan(1);
    for (const c of chips) expect(c.hasAttribute('aria-pressed')).toBe(true);
  });
});

describe('trainer day tag (program review row)', () => {
  it('shows on the trainer weekdays only', async () => {
    configureClientCoach({
      port: createFixturesClientPort({ scenario: 'active' }),
      chat: createFixturesClientChatPort({ unread: 0 }),
    });
    render(
      <>
        <div data-testid="tue">
          <ClientTrainerDayTag dow={2} />
        </div>
        <div data-testid="wed">
          <ClientTrainerDayTag dow={3} />
        </div>
      </>,
    );
    await waitFor(() =>
      expect(within(screen.getByTestId('tue')).queryByText(t.pgWithTrainer)).toBeTruthy(),
    );
    expect(within(screen.getByTestId('wed')).queryByText(t.pgWithTrainer)).toBeNull();
  });
});

describe('client chat', () => {
  it('the log holds a list (role log is on a div), and a picked share is sent as a share message', async () => {
    const chat = createFixturesClientChatPort({ unread: 0 });
    const port = createFixturesClientPort({ scenario: 'active' });
    configureClientCoach({ port, chat });
    render(<ClientChat onBack={() => undefined} onOpenSharing={() => undefined} />);
    const log = await screen.findByRole('log');
    expect(log.tagName).toBe('DIV');
    expect(log.querySelector('ol')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Share in chat' }));
    const options = await screen.findAllByRole('option');
    fireEvent.click(options[0]);
    const send = await screen.findByRole('button', { name: /send/i });
    await waitFor(() => expect((send as HTMLButtonElement).disabled).toBe(false));
    let last: unknown;
    const off = chat.subscribe(
      'cid-c1',
      (d) => (last = d.messages[d.messages.length - 1]),
      () => undefined,
    );
    fireEvent.click(send);
    await waitFor(() =>
      expect((last as { body: { kind: string } } | undefined)?.body.kind).toBe('share'),
    );
    off();
  });
});
