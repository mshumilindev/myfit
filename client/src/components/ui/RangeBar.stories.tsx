import type { Meta, StoryObj } from '@storybook/react-vite';
import { RangeBar } from './RangeBar';
import { Row, Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Coach/Range bar',
  component: RangeBar,
  args: {
    value: 12,
    max: 24,
    band: [10, 16],
    tone: 'ok',
    label: 'Chest 12 sets, range 10 to 16, in range',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RangeBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Below, in range, above, none set: the state is always said in text beside the bar in the real screen. */
export const States: Story = {
  render: () => (
    <Stack>
      <Row>
        <RangeBar
          value={4}
          max={24}
          band={[10, 16]}
          tone="danger"
          label="Back 4 sets, range 12 to 20, below"
        />
      </Row>
      <Row>
        <RangeBar
          value={12}
          max={24}
          band={[10, 16]}
          tone="ok"
          label="Chest 12 sets, range 10 to 16, in range"
        />
      </Row>
      <Row>
        <RangeBar
          value={20}
          max={24}
          band={[8, 14]}
          tone="illness"
          label="Shoulders 20 sets, range 8 to 14, above"
        />
      </Row>
      <Row>
        <RangeBar value={0} max={24} band={[6, 12]} tone="rest" label="Calves no sets set" />
      </Row>
    </Stack>
  ),
};
