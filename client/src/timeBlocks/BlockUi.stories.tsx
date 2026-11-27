import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import './blocks.css';
import { PageFrame } from '../stories/PageFrame';
import { BlockEndedBar, BlockReadyCard, BlockResultCard, BlockTimerCard } from './BlockUi';
import type { WorkoutBlock } from './model';

/**
 * Time blocks in a session (SPO-608): a built block before it starts, the running clock (AMRAP, EMOM, For time,
 * intervals), a paused one, the ended bar and the result card. The cards are presentational: the session owns the clock.
 */
const members = [
  { name: 'Pullups', reps: '5' },
  { name: 'Push-ups', reps: '10' },
  { name: 'Air Squat', reps: '15' },
];
const amrap: WorkoutBlock = {
  id: 'b1',
  spec: { fmt: 'amrap', capSec: 12 * 60 },
  members,
  position: 1.5,
  roundsDone: 3,
};
const emom: WorkoutBlock = {
  id: 'b2',
  spec: { fmt: 'emom', everySec: 60, rounds: 10 },
  members: members.slice(0, 2),
  position: 1.5,
};
const fortime: WorkoutBlock = {
  id: 'b3',
  spec: { fmt: 'fortime', capSec: 15 * 60, scheme: [21, 15, 9] },
  members: members.slice(0, 2),
  position: 1.5,
  roundsDone: 1,
};
const intervals: WorkoutBlock = {
  id: 'b4',
  spec: { fmt: 'intervals', workSec: 40, restSec: 20, rounds: 8 },
  members: members.slice(0, 2),
  position: 1.5,
};
const noop = () => undefined;

const meta = {
  title: 'Pages/Time blocks',
  component: BlockReadyCard,
  parameters: { layout: 'fullscreen' },
  args: { block: amrap, onEdit: noop, onStart: noop },
  decorators: [
    (Story) => (
      <PageFrame>
        <div className="screen">
          <Story />
        </div>
      </PageFrame>
    ),
  ],
} satisfies Meta<typeof BlockReadyCard>;
export default meta;
type Story = StoryObj<typeof meta>;

const timer = (block: WorkoutBlock, elapsedSec: number, paused = false): ReactNode => (
  <BlockTimerCard
    block={block}
    elapsedSec={elapsedSec}
    paused={paused}
    onPause={noop}
    onResume={noop}
    onRound={noop}
    onFinish={noop}
  />
);

/** Built, not started. */
export const Ready: Story = {};
export const RunningAmrap: Story = { render: () => <>{timer(amrap, 4 * 60 + 12)}</> };
export const RunningEmom: Story = { render: () => <>{timer(emom, 3 * 60 + 25)}</> };
export const RunningForTime: Story = { render: () => <>{timer(fortime, 5 * 60 + 40)}</> };
export const IntervalsRest: Story = { render: () => <>{timer(intervals, 40 + 8)}</> };
export const Paused: Story = { render: () => <>{timer(amrap, 4 * 60 + 12, true)}</> };
export const Ended: Story = {
  render: () => <BlockEndedBar block={amrap} capHit onLog={noop} />,
};
export const ResultAmrap: Story = {
  render: () => (
    <BlockResultCard
      block={amrap}
      initial={{ rounds: 5, extraReps: 7, savedAt: 1 }}
      onSave={noop}
    />
  ),
};
export const ResultForTime: Story = {
  render: () => (
    <BlockResultCard
      block={fortime}
      initial={{ timeSec: 11 * 60 + 30, savedAt: 1 }}
      onSave={noop}
    />
  ),
};
