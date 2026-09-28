import type { Meta, StoryObj } from '@storybook/react-vite';
import { CategoryRow } from './CategoryRow';
import { LocaleMatrix, Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/CategoryRow',
  component: CategoryRow,
  args: {
    tone: 'accent',
    icon: 'heartbeat',
    title: 'Conditioning',
    count: 13,
    meta: 'last: Dance · Sat',
    minis: ['disco-ball', 'person-simple-run', 'person-simple-walk', 'bicycle'],
    onClick: () => undefined,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CategoryRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The three browse families (mobile stack layout). */
export const Families: Story = {
  render: () => (
    <Stack gap={8}>
      <CategoryRow
        tone="accent"
        icon="heartbeat"
        title="Conditioning"
        count={13}
        meta="last: Dance · Sat"
        minis={['disco-ball', 'person-simple-run', 'person-simple-walk']}
        onClick={() => undefined}
      />
      <CategoryRow
        tone="sport"
        icon="trophy"
        title="Sports"
        count={16}
        meta="last: Tennis · Wed"
        minis={['tennis-ball', 'soccer-ball', 'ping-pong']}
        onClick={() => undefined}
      />
      <CategoryRow
        tone="rest"
        icon="flower-lotus"
        title="Recovery"
        count={5}
        meta="last: Sauna · Sat"
        minis={['fire', 'flower-lotus', 'person-arms-spread']}
        onClick={() => undefined}
      />
    </Stack>
  ),
};

/** Web inline layout: minis on the right, selected (open in Quick log), no chevron. */
export const InlineSelected: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 760 }}>
        <Story />
      </div>
    ),
  ],
  args: { layout: 'inline', selected: true, chevron: false, meta: 'Run open in Quick log' },
};

/** Muted minis while starting is locked (a workout is live). */
export const Locked: Story = { args: { muted: true, meta: 'Log the past only' } };

/** Meta text in five locales. */
export const LongText: Story = {
  render: () => (
    <LocaleMatrix
      render={(t) => (
        <CategoryRow
          tone="sport"
          icon="trophy"
          title={t.actSports}
          count={16}
          meta={t.laLogPastOnly}
          minis={['tennis-ball', 'soccer-ball', 'ping-pong']}
          onClick={() => undefined}
        />
      )}
    />
  ),
};
