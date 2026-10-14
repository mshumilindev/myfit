import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setFlag } from '../../data/flags';
import { scheduleEn } from '../../i18n/coachSchedule.en';
import { setViewport } from '../testViewport';
import { configureClientCoach } from './data/config';
import { createFixturesClientChatPort } from './data/__fixtures__/chat';
import { createFixturesClientPort } from './data/__fixtures__/fixtures';
import { ClientChat } from './screens/ClientChat';
import { configureSchedule } from '../schedule/useSchedule';
import { createFixturesSchedulePort, scheduleSeed } from '../schedule/__fixtures__/fixtures';

beforeEach(() => {
  setViewport(1440);
  setFlag('coach', true);
});
afterEach(() => {
  cleanup();
  configureClientCoach();
  configureSchedule(null);
});

describe('"Suggest another time" on the trainer\'s request card', () => {
  it('opens the form as an answer to THAT request (the counter title), not as a new request', async () => {
    // the card in the thread is asked by the TRAINER, so the client may answer with another time
    const seed = scheduleSeed();
    seed.requests = seed.requests.map((r) =>
      r.id === 'rq1' ? { ...r, from: 'trainer' as const } : r,
    );
    configureSchedule(createFixturesSchedulePort({ seed }));
    configureClientCoach({
      port: createFixturesClientPort({ scenario: 'active' }),
      chat: createFixturesClientChatPort({ unread: 0 }),
    });
    render(<ClientChat onBack={() => undefined} onOpenSharing={() => undefined} />);
    const counter = await screen.findByRole('button', { name: scheduleEn.rcCounter });
    fireEvent.click(counter);
    await waitFor(() =>
      expect(screen.getAllByText(scheduleEn.rfTitleCounter).length).toBeGreaterThan(0),
    );
  });
});
