import type { Meta, StoryObj } from '@storybook/react-vite';
import { DayTimelineDay } from './DayTimeline';
import { Card } from './Card';

const meta = { title: 'Kit/DayTimeline', component: DayTimelineDay } satisfies Meta<
  typeof DayTimelineDay
>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Every day state: trained · rest · illness · missed · vacation · logged. */
export const States: Story = {
  args: { tone: 'ok', date: 'TODAY · SEP 29' },
  render: () => (
    <div className="hist-tl" style={{ padding: 16 }}>
      <DayTimelineDay tone="ok" icon="check" date="TODAY · SEP 29" isToday>
        <Card pad="none">Trained</Card>
      </DayTimelineDay>
      <DayTimelineDay tone="rest" icon="flower-lotus" date="SUN · SEP 27 · REST DAY" />
      <DayTimelineDay tone="active" icon="pulse" date="WED · SEP 23 · SICK DAY" />
      <DayTimelineDay tone="danger" icon="x" date="FRI · SEP 25 · MISSED" />
      <DayTimelineDay tone="illness" icon="airplane-tilt" date="TUE · SEP 22 · FULL REST" />
      <DayTimelineDay tone="neutral" date="MON · SEP 21" isLast />
    </div>
  ),
};
