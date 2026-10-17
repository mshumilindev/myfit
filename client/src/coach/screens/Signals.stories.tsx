import type { Meta, StoryObj } from '@storybook/react-vite';
import { createFixturesPort } from '../data/__fixtures__/fixtures';
import { CoachStoryFrame } from '../../stories/coachStoryKit';
import { emptyRoster, worldPort } from './storyPorts';

/** All signals (S-20): list with filters, inspector with the evidence peek (drawer on a phone). */
const meta = {
  title: 'Pages/Coach/Signals',
  component: CoachStoryFrame,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CoachStoryFrame>;
export default meta;
type Story = StoryObj<typeof meta>;
const route = { screen: 'signals' } as const;

export const Signals: Story = {
  args: { route, makePort: () => worldPort(undefined, { warm: true }) },
};
export const Empty: Story = {
  args: { route, makePort: () => worldPort(emptyRoster, { warm: true }) },
};
export const Loading: Story = {
  args: { route, makePort: () => createFixturesPort({ delayMs: 60_000 }) },
};
export const LoadFailed: Story = {
  args: { route, makePort: () => createFixturesPort({ failWith: () => 'unavailable' }) },
};
