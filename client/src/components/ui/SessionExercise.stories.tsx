import type { Meta, StoryObj } from '@storybook/react-vite';
import { SessionExercise } from './SessionExercise';

const meta = {
  title: 'Coach/Session exercise',
  component: SessionExercise,
  args: {
    name: 'Overhead press',
    muscles: 'Shoulders, Triceps',
    target: '3 × 6 · 40 kg · RPE 8 · rest 2:30',
    setLabel: 'Set 1',
    kgPlaceholder: 'kg',
    repsPlaceholder: 'reps',
    preview: true,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SessionExercise>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithTargets: Story = {};

/** A bare exercise: nothing is prescribed, the client picks the numbers. */
export const JustTheExercise: Story = {
  args: {
    target: undefined,
    noTarget: 'No target for this exercise',
    caption: 'Iryna chooses the numbers in the session.',
  },
};

export const WithCaption: Story = {
  args: { caption: 'Iryna sees the target above the set and logs what she lifts.' },
};
