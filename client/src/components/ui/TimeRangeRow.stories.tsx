import type { Meta, StoryObj } from '@storybook/react-vite';
import { GroupedList, ListRow } from './GroupedList';
import { TimeRangeRow } from './TimeRangeRow';

const meta = {
  title: 'Kit/TimeRangeRow',
  component: TimeRangeRow,
  args: {
    fromLabel: 'From',
    toLabel: 'To',
    from: '09:00',
    to: '10:30',
    onFrom: () => {},
    onTo: () => {},
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <GroupedList>
          <Story />
          <ListRow action tone="danger" label="Remove these hours" />
        </GroupedList>
      </div>
    ),
  ],
} satisfies Meta<typeof TimeRangeRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
