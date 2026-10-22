import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import { createFixturesPort } from '../../data/__fixtures__/fixtures';
import { CoachStoryFrame } from '../../../stories/coachStoryKit';
import { emptyRoster, worldPort } from '../storyPorts';

/** Programs (S-21) inside the real shell. 1440 / 1024 = list + detail, 390 = list, then the pushed detail. */
const meta = {
  title: 'Pages/Coach/Programs',
  component: CoachStoryFrame,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CoachStoryFrame>;
export default meta;
type Story = StoryObj<typeof meta>;

const route = { screen: 'programs' } as const;
const ready = () => worldPort(undefined, { warm: true });

export const Programs: Story = { args: { route, makePort: ready } };
export const Empty: Story = {
  args: { route, makePort: () => worldPort(emptyRoster, { warm: true }) },
};
export const Loading: Story = {
  args: { route, makePort: () => createFixturesPort({ delayMs: 60_000 }) },
};
export const LoadFailed: Story = {
  args: { route, makePort: () => createFixturesPort({ failWith: () => 'unavailable' }) },
};
export const NoMatch: Story = {
  args: { route, makePort: ready },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.type(await c.findByRole('searchbox', { name: 'Search programs' }), 'zzz');
  },
};
export const NewProgramChooser: Story = {
  args: { route, makePort: ready },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(await c.findByRole('button', { name: 'New program' }));
  },
};
