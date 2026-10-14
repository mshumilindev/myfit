import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import { CoachStoryFrame } from '../storyKit';
import { worldPort } from '../storyPorts';
import { createFixturesLivePort, defaultLiveSessions } from './__fixtures__/fixtures';
import type { CoachLiveSession } from './port';
import { createFixturesPort } from '../../data/__fixtures__/fixtures';

/**
 * Live (S-22 / C-21) inside the real shell: the list of who is training, one client's live page in each state, the
 * header widget. Service fields only; there is no per-set grid (R-FE-062).
 */
const meta = {
  title: 'Pages/Coach/Live',
  component: CoachStoryFrame,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CoachStoryFrame>;
export default meta;
type Story = StoryObj<typeof meta>;

const ready = () => worldPort(undefined, { warm: true });
const frozen = () => createFixturesLivePort({ freeze: true });
const one = (cid: string) => ({ screen: 'client', cid, tab: 'live' }) as const;

export const List: Story = {
  args: { route: { screen: 'live' }, makePort: ready, makeLive: frozen },
};
export const ClientLive: Story = { args: { route: one('c5'), makePort: ready, makeLive: frozen } };
export const ClientOffline: Story = {
  args: { route: one('c2'), makePort: ready, makeLive: frozen },
};
export const ClientFinished: Story = {
  args: { route: one('c7'), makePort: ready, makeLive: frozen },
};
export const ClientNotTraining: Story = {
  args: { route: one('c1'), makePort: ready, makeLive: frozen },
};
export const NobodyLive: Story = {
  args: {
    route: { screen: 'live' },
    makePort: ready,
    makeLive: () => createFixturesLivePort({ sessions: () => [], freeze: true }),
  },
};
const twice = (now: number): CoachLiveSession[] => {
  const [a] = defaultLiveSessions(now);
  return [{ ...a, id: 'u-old', startedAt: a.startedAt - 90 * 60_000, updatedAt: now - 70_000 }, a];
};
export const TwoSessionsOneClient: Story = {
  args: {
    route: one('c5'),
    makePort: ready,
    makeLive: () => createFixturesLivePort({ sessions: twice, freeze: true }),
  },
};
export const Loading: Story = {
  args: {
    route: { screen: 'live' },
    makePort: () => createFixturesPort({ delayMs: 60_000 }),
    makeLive: () => ({ now: () => 0, subscribe: () => () => undefined }),
  },
};
export const FeedUnavailable: Story = {
  args: {
    route: { screen: 'live' },
    makePort: ready,
    makeLive: () => createFixturesLivePort({ fail: true }),
  },
};
/** live-widget-open: the header pill opened over any screen. */
export const WidgetOpen: Story = {
  args: { route: { screen: 'agenda' }, makePort: ready, makeLive: frozen },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const pills = await c.findAllByRole('button', { name: /live/i });
    await userEvent.click(pills[0]);
  },
};
