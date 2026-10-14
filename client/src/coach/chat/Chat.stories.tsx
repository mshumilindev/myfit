import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChatStoryFrame } from './ChatStoryFrame';
import { createFixturesChatPort } from './__fixtures__/fixtures';
import type { ChatPort } from './port';

/**
 * Chat (S-16) inside the real shell. Pick the viewport in the toolbar: 1440 / 1024 = list + thread, 390 = the
 * list alone (open `Thread phone` for a pushed thread). Seed: Maria 12 unread (9+), Oleh 3, Andriy 1; rail total 16.
 */
const meta = {
  title: 'Pages/Coach/Chat',
  component: ChatStoryFrame,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ChatStoryFrame>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Chat: Story = { args: { makePort: () => createFixturesChatPort() } };
export const ThreadPhone: Story = {
  args: { makePort: () => createFixturesChatPort(), hash: '#/c/chat?with=c1' },
};
export const Empty: Story = { args: { makePort: () => createFixturesChatPort({ empty: true }) } };
const never: ChatPort = { ...createFixturesChatPort(), subscribeThreads: () => () => undefined };
export const Loading: Story = { args: { makePort: () => never } };
export const SendFails: Story = {
  args: { makePort: () => createFixturesChatPort({ failSend: () => true }) },
};

/** Desktop chat dock (>= 1280 only): the round button with the unread total; the panel opens over Today. */
export const DockClosed: Story = {
  args: { makePort: () => createFixturesChatPort(), start: { screen: 'agenda' } },
};
export const DockList: Story = {
  args: { makePort: () => createFixturesChatPort(), start: { screen: 'agenda' }, dockOpen: true },
};
/** The popover is a solid frosted plate (about 96% opaque, 440 px): the busy week grid behind it never reads through. */
export const DockListOverSchedule: Story = {
  args: { makePort: () => createFixturesChatPort(), start: { screen: 'schedule' }, dockOpen: true },
};
export const DockThread: Story = {
  args: { makePort: () => createFixturesChatPort(), start: { screen: 'agenda' }, dockOpen: 'c1' },
};
