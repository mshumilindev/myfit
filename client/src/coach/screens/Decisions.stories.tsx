import type { Meta, StoryObj } from '@storybook/react-vite';
import { createFixturesPort } from '../data/__fixtures__/fixtures';
import { CoachStoryFrame } from '../../stories/coachStoryKit';
import { worldPort } from './storyPorts';

/** Decisions (S-19): summary + insight, filters, history, Decision record (side panel / inline on a phone), CSV export. */
const meta = {
  title: 'Pages/Coach/Decisions',
  component: CoachStoryFrame,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CoachStoryFrame>;
export default meta;
type Story = StoryObj<typeof meta>;
const route = { screen: 'decisions' } as const;

export const Decisions: Story = {
  args: { route, makePort: () => worldPort(undefined, { warm: true }) },
};
export const Empty: Story = {
  args: {
    route,
    makePort: () =>
      worldPort((w) => ({ ...w, book: { ...w.book, decisions: [] } }), { warm: true }),
  },
};
export const Loading: Story = {
  args: { route, makePort: () => createFixturesPort({ delayMs: 60_000 }) },
};
export const LoadFailed: Story = {
  args: { route, makePort: () => createFixturesPort({ failWith: () => 'unavailable' }) },
};
