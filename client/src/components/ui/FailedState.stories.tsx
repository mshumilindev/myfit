import type { Meta, StoryObj } from '@storybook/react-vite';
import { FailedState } from './FailedState';
import { Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/FailedState',
  component: FailedState,
  args: {
    title: "Couldn't load",
    body: 'Check your connection. Your data is safe on this device.',
    retryLabel: 'Retry',
    onRetry: () => undefined,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FailedState>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** With and without retry; title only. */
export const Variants: Story = {
  render: () => (
    <Stack>
      <FailedState
        title="Couldn't load"
        body="Check your connection. Your data is safe on this device."
        retryLabel="Retry"
        onRetry={() => undefined}
      />
      <FailedState title="Gym search is unavailable" body="The provider did not answer." />
      <FailedState title="Something went wrong" />
    </Stack>
  ),
};
