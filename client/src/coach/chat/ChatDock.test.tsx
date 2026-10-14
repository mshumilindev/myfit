import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chatEn as ch } from '../../i18n/coachChat.en';
import { setViewport } from '../testViewport';
import { ChatStoryFrame } from './ChatStoryFrame';
import { createFixturesChatPort } from './__fixtures__/fixtures';
import { dock } from './dockStore';

beforeEach(() => {
  dock.reset();
  setViewport(1440);
});
afterEach(() => {
  cleanup();
  dock.reset();
});

const makePort = () => createFixturesChatPort();

describe('Chat dock', () => {
  it('shows a labelled button with the unread total on wide screens', async () => {
    render(<ChatStoryFrame makePort={makePort} start={{ screen: 'agenda' }} />);
    const aside = await screen.findByRole('region', { name: ch.chDockLabel });
    const btn = await screen.findByRole('button', { name: ch.chDockOpen });
    expect(aside.contains(btn)).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the list, then a thread with a composer, and closes again', async () => {
    render(<ChatStoryFrame makePort={makePort} start={{ screen: 'agenda' }} />);
    const aside = await screen.findByRole('region', { name: ch.chDockLabel });
    fireEvent.click(within(aside).getByRole('button', { name: ch.chDockOpen }));
    const list = await within(aside).findByRole(
      'list',
      { name: ch.chListLabel },
      { timeout: 4000 },
    );
    fireEvent.click(within(list).getAllByRole('button')[0]);
    expect(await within(aside).findByRole('textbox', {}, { timeout: 4000 })).toBeTruthy();
    fireEvent.click(within(aside).getByRole('button', { name: ch.chDockClose }));
    await waitFor(() => expect(within(aside).queryByRole('textbox')).toBeNull());
  });

  it('is absent on the Chat screen and below 1280', async () => {
    const { unmount } = render(<ChatStoryFrame makePort={makePort} />);
    await screen.findAllByText(/Maria/);
    expect(screen.queryByRole('region', { name: ch.chDockLabel })).toBeNull();
    unmount();
    setViewport(1024);
    render(<ChatStoryFrame makePort={makePort} start={{ screen: 'agenda' }} />);
    await waitFor(() => expect(screen.queryByRole('region', { name: ch.chDockLabel })).toBeNull());
  });
});
