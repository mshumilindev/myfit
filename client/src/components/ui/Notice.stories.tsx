import type { Meta, StoryObj } from '@storybook/react-vite';
import { Notice } from './Notice';
import { ProgressBar } from './ProgressBar';
import { Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/Notice',
  component: Notice,
  args: { tone: 'danger', icon: 'cloud-slash', children: 'Offline — 3 changes queued' },
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Notice>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Offline, syncing with a bar, neutral hint, ok. */
export const Variants: Story = {
  render: () => (
    <Stack>
      <Notice tone="danger" icon="cloud-slash">
        Offline — 3 changes queued
      </Notice>
      <Notice
        tone="neutral"
        icon="arrows-clockwise"
        trail="3"
        below={<ProgressBar value={66} height={4} />}
      >
        Sending queued changes…
      </Notice>
      <Notice tone="rest" icon="moon">
        Rest day — nothing planned.
      </Notice>
      <Notice tone="ok" icon="check">
        Saved on this device.
      </Notice>
    </Stack>
  ),
};
