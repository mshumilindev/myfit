import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatTile } from './StatTile';
import { Card } from './Card';
import { TONES } from './tones';
import { Row, Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/StatTile',
  component: StatTile,
  args: {
    label: 'Readiness',
    value: 82,
    unit: '%',
    tone: 'ok',
    sub: '2 recovering',
    bar: 82,
    big: true,
  },
  argTypes: { tone: { control: 'select', options: TONES } },
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StatTile>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The Today "Body" pair, KPI with delta, plain small stats. */
export const Variants: Story = {
  render: () => (
    <Stack>
      <Row>
        <Card style={{ flex: 1 }}>
          <StatTile
            label="Readiness"
            value={82}
            unit="%"
            tone="ok"
            sub="2 recovering"
            bar={82}
            big
          />
        </Card>
        <Card style={{ flex: 1 }}>
          <StatTile label="Last night" value="8h" unit="30m" tone="sleep" sub="02:00 → 10:30" big />
        </Card>
      </Row>
      <Card>
        <Row>
          <StatTile label="Volume" value="5.8" unit="t" delta="+4%" tone="accent" />
          <StatTile label="Sets" value={26} />
          <StatTile label="e1RM bench" value={112} unit="kg" delta="PR" tone="ok" />
        </Row>
      </Card>
    </Stack>
  ),
};
