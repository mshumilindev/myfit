import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import './blocks.css';
import { PageFrame } from '../stories/PageFrame';
import type { Workout } from '../types';
import { emptyDoc, type ProgramDoc } from '../tools/programEditor';
import { BlockBuilder } from './BlockBuilder';
import { BlockCountdownRun } from './BlockCountdownRun';
import { BlockPicker } from './BlockPicker';
import { BlockRecap } from './BlockRecap';
import { Conditioning } from './Conditioning';
import { ProgramDayBlocks } from './ProgramDayBlocks';
import type { BlockSpec, WorkoutBlock } from './model';

/**
 * Time blocks (SPO-608): the screens around the cards: the builder and the exercise picker, the countdown overlay,
 * the block row in a program day (trainer editor), the trainer's recap and the conditioning line.
 */
const noop = () => undefined;
const spec: BlockSpec = { fmt: 'amrap', capSec: 12 * 60 };
const members = [
  { name: 'Pullups', reps: '5' },
  { name: 'Push-ups', reps: '10' },
  { name: 'Air Squat', reps: '15' },
];
const logged: WorkoutBlock = {
  id: 'l1',
  spec,
  members,
  position: 1.5,
  run: { startedAt: 1_000, pausedMs: 0, pausedAt: null, finishedAt: 1_000 + 12 * 60_000 },
  result: { rounds: 5, extraReps: 7, capHit: true, savedAt: 1_000 + 13 * 60_000 },
};
const workout = { id: 'w1', blocks: [logged] } as unknown as Workout;

const meta = {
  title: 'Pages/Time blocks/Screens',
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <PageFrame>
        <div className="screen">
          <Story />
        </div>
      </PageFrame>
    ),
  ],
} satisfies Meta;
export default meta;
type S = StoryObj<typeof meta>;

export const BuilderNew: S = {
  render: () => <BlockBuilder onSave={noop} onClose={noop} onPickExercise={noop} />,
};
export const BuilderEdit: S = {
  render: () => (
    <BlockBuilder
      initial={{ spec: { fmt: 'fortime', capSec: 900, scheme: [21, 15, 9] }, members }}
      onSave={noop}
      onClose={noop}
      onPickExercise={noop}
    />
  ),
};
export const Picker: S = {
  render: () => <BlockPicker spec={spec} added={['Pullups']} onPick={noop} onClose={noop} />,
};
export const Countdown: S = {
  render: () => (
    <BlockCountdownRun
      spec={spec}
      prefs={{ sound: false, vibrate: false }}
      onStart={noop}
      onClose={noop}
      onCancel={noop}
    />
  ),
};

const programDoc: ProgramDoc = {
  ...emptyDoc('Conditioning week'),
  blocks: [
    { id: 'p1', day: 1, position: 0, spec, members },
    {
      id: 'p2',
      day: 1,
      position: 1,
      spec: { fmt: 'intervals', workSec: 40, restSec: 20, rounds: 8 },
      members: members.slice(0, 2),
    },
  ],
};
function DayEditor({ readOnly }: { readOnly: boolean }) {
  const [doc, setDoc] = useState(programDoc);
  return (
    <ProgramDayBlocks doc={doc} day={1} readOnly={readOnly} edit={(fn) => setDoc((d) => fn(d))} />
  );
}
export const ProgramDay: S = { render: () => <DayEditor readOnly={false} /> };
export const ProgramDayReadOnly: S = { render: () => <DayEditor readOnly /> };
export const TrainerRecap: S = { render: () => <BlockRecap workout={workout} /> };
export const ConditioningLine: S = { render: () => <Conditioning workouts={[workout]} /> };
