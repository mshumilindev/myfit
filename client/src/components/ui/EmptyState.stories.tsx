import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmptyState } from './EmptyState';
import { Button } from './Button';
import { Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/EmptyState',
  component: EmptyState,
  args: {
    icon: 'barbell',
    title: 'No sessions yet',
    body: 'Start a workout and it will show up here.',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EmptyState>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** With an action, centred, title only. */
export const Variants: Story = {
  render: () => (
    <Stack>
      <EmptyState
        icon="barbell"
        title="No sessions yet"
        body="Start a workout and it will show up here."
      >
        <Button variant="primary" size="sm">
          Start workout
        </Button>
      </EmptyState>
      <EmptyState
        icon="magnifying-glass"
        title="Nothing matches"
        body="Try another name."
        centered
      />
      <EmptyState icon="check" title="All caught up" />
    </Stack>
  ),
};
