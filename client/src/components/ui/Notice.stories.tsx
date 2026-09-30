import type { Meta, StoryObj } from '@storybook/react-vite';
import { Notice } from './Notice';
import { ProgressBar } from './ProgressBar';
import { GroupedList, ListRow } from './GroupedList';
import { IconTile } from './IconTile';
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

/** Standing in a list of rows: icon tile and text line up with the ListRows around it. */
export const AlignedWithRows: Story = {
  render: () => (
    <Stack>
      <GroupedList>
        <ListRow
          icon={<IconTile tone="chronic" size={30} icon="plus" />}
          label="Add a condition"
          chevron
        />
      </GroupedList>
      <Notice tone="chronic" icon="shield-check" aligned>
        No long-term conditions yet. Add one, and your plans and suggestions adapt to it.
      </Notice>
    </Stack>
  ),
};

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
