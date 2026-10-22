import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState, type ReactNode } from 'react';
import { FIXTURE_NOW } from '../../data/__fixtures__/fixtures';
import { opaqueSlotKey } from '../../schedule/ids';
import {
  createFixturesSchedulePort,
  scheduleSeed,
  WEEK0,
} from '../../schedule/__fixtures__/fixtures';
import { tsOf } from '../../schedule/time';
import { configureSchedule } from '../../schedule/useSchedule';
import type { RescheduleRequest } from '../../schedule/types';
import { createFixturesClientChatPort } from '../data/__fixtures__/chat';
import { createFixturesClientPort } from '../data/__fixtures__/fixtures';
import { configureClientCoach } from '../data/config';
import { MyTrainerPage } from '../screens/MyTrainerPage';
import { ClientSpotterScreen } from './ClientSpotterScreen';
import { configureClientSpotter } from './config';
import {
  createFixturesClientSpotterPort,
  type FixturesClientSpotterOptions,
} from './__fixtures__/fixtures';

const noop = () => undefined;

/** A request the team manager made for this client (board C1); the trainer's own `rq2` is in the seed already. */
const BY_MANAGER: RescheduleRequest = {
  id: 'mq1',
  clientId: 'c2',
  from: 'trainer',
  via: 'manager',
  byName: 'Irina M.',
  slotKey: opaqueSlotKey(`r-c2-wed:${WEEK0 + 2}`),
  fromStart: tsOf(WEEK0 + 2, 18 * 60),
  toStart: tsOf(WEEK0 + 3, 10 * 60),
  note: 'Gym is closed.',
  status: 'pending',
  createdAt: FIXTURE_NOW - 1000,
  expiresAt: FIXTURE_NOW + 86_400_000,
  scope: 'all',
};

/** Points the module-level adapters at this story's fixtures BEFORE the first render (the real hooks read them). */
function World({
  spotter,
  withManagerRequest,
  children,
}: {
  spotter?: FixturesClientSpotterOptions;
  withManagerRequest?: boolean;
  children: ReactNode;
}) {
  useState(() => {
    const base = createFixturesClientPort({ scenario: 'active', now: () => FIXTURE_NOW });
    const snap = { ...base.state(), link: { ...base.state().link, clientId: 'c2' } };
    configureClientCoach({
      port: {
        ...base,
        peek: () => snap,
        subscribe: (on: (s: typeof snap) => void) => (on(snap), () => undefined),
      },
      chat: createFixturesClientChatPort({ unread: 3 }),
    });
    const seed = scheduleSeed();
    configureSchedule(
      createFixturesSchedulePort({
        seed: withManagerRequest ? { ...seed, requests: [...seed.requests, BY_MANAGER] } : seed,
        now: () => FIXTURE_NOW,
      }),
    );
    configureClientSpotter(createFixturesClientSpotterPort({ now: FIXTURE_NOW, ...spotter }));
  });
  useEffect(
    () => () => {
      configureClientCoach();
      configureSchedule(null);
      configureClientSpotter(null);
    },
    [],
  );
  return <>{children}</>;
}

const meta = {
  title: 'Pages/Coach/Client Spotter',
  parameters: { layout: 'fullscreen', viewport: { value: 'phone' } },
  globals: { viewport: { value: 'phone', isRotated: false } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const thread = (spotter?: FixturesClientSpotterOptions): Story => ({
  render: () => (
    <World spotter={spotter}>
      <ClientSpotterScreen onBack={noop} />
    </World>
  ),
});

/** Board C5: the pinned service chat. Read-only: no composer, a Notice instead; a move request is the answerable card. */
export const Thread: Story = thread();
export const ThreadDesktop: Story = {
  ...thread(),
  parameters: { viewport: { value: 'desktop' } },
  globals: { viewport: { value: 'desktop', isRotated: false } },
};
export const ThreadEmpty: Story = thread({ items: [] });
export const ThreadLoading: Story = thread({ cold: true });
export const ThreadFailed: Story = thread({ fail: true });

/** Board C4: Spotter pinned above the chat with the trainer, with the unread badge. */
export const PinnedOnMyTrainer: Story = {
  render: () => (
    <World>
      <MyTrainerPage
        onBack={noop}
        onChat={noop}
        onSpotter={noop}
        onSharing={noop}
        onProgram={noop}
        onLeft={noop}
      />
    </World>
  ),
};

/** Board C1: "Irina M. from Olena's team asks to move a session" with Accept / Decline / Propose another. */
export const MoveRequestFromTeam: Story = {
  render: () => (
    <World withManagerRequest>
      <MyTrainerPage
        onBack={noop}
        onChat={noop}
        onSpotter={noop}
        onSharing={noop}
        onProgram={noop}
        onLeft={noop}
      />
    </World>
  ),
};
