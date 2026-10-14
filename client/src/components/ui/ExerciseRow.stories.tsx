import type { Meta, StoryObj } from '@storybook/react-vite';
import { ExerciseRow } from './ExerciseRow';
import { GroupedList } from './GroupedList';
import { Chip } from './Chip';

const meta = {
  title: 'Coach/Exercise row',
  component: ExerciseRow,
  args: {
    name: 'Back squat',
    sub: 'Quads · Glutes',
    prescription: '3 × 6 · target 60 kg · RPE 8',
    chevron: true,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 520, maxWidth: '100%' }}>
        <GroupedList label="Exercises">
          <Story />
        </GroupedList>
      </div>
    ),
  ],
} satisfies Meta<typeof ExerciseRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** A bare exercise has no prescription: name and picture only. */
export const JustTheExercise: Story = { args: { prescription: undefined, sub: undefined } };

export const Selected: Story = { args: { selected: true, 'aria-pressed': true } };

export const Superset: Story = { args: { badge: 'A1' } };

/** The editor's trailing columns and the "Add sets and reps" chip of a bare row. */
export const WithTrailing: Story = {
  args: {
    prescription: undefined,
    trailing: (
      <Chip size="xs" nested>
        Add sets and reps
      </Chip>
    ),
  },
};

export const LongName: Story = {
  args: {
    name: 'Romanian deadlift with a slow lowering phase and a pause at the knee',
    sub: 'Hamstrings · Glutes · Lower back',
  },
};
