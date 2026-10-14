import type { Meta, StoryObj } from '@storybook/react-vite';
import './programs.css';
import { PageFrame } from '../../stories/PageFrame';
import { freshProgram, type Program } from './model';
import { ProgramPage } from './ProgramPage';

const item = (
  id: string,
  day: number,
  position: number,
  name: string,
  sets: number,
  reps: number,
) => ({
  id,
  day,
  position,
  name,
  kind: 'strength' as const,
  sets,
  reps,
  durationMin: null,
  equipment: [],
});

const program = (): Program => ({
  ...freshProgram('Strength 3x'),
  id: 'pg',
  status: 'active',
  authorId: 'me',
  dayNames: { '1': 'Upper A', '3': 'Lower A', '5': 'Full body' },
  items: [
    { ...item('w1', 1, 0, 'Warm-up', 1, 0), kind: 'warmup' as const },
    item('a', 1, 1, 'Barbell Bench Press - Medium Grip', 4, 6),
    item('b', 1, 2, 'Barbell Shoulder Press', 3, 8),
    item('c', 1, 3, 'Cable Triceps Pushdown', 3, 12),
    item('d', 3, 0, 'Barbell Squat', 4, 5),
    item('e', 3, 1, 'Romanian Deadlift', 3, 8),
    item('f', 5, 0, 'Pullups', 3, 8),
    item('g', 5, 1, 'Dumbbell Bench Press', 3, 10),
  ],
  activities: [{ id: 'x', day: 2, type: 'run', minutes: 20, effort: 'light', when: 'after' }],
});

function Page(p: { saved?: boolean; readOnly?: boolean; draft?: boolean }) {
  return (
    <PageFrame>
      <ProgramPage
        initial={p.draft ? freshProgram('') : program()}
        saved={p.saved ?? true}
        readOnly={p.readOnly}
        library={[program()]}
        shell={{ openOverlay: () => undefined } as never}
        onClose={() => undefined}
        onSaved={() => undefined}
        onDeleted={() => undefined}
        onAssign={() => undefined}
      />
    </PageFrame>
  );
}

/** The athlete's Programs builder (own program) and the read-only review of a trainer's program. */
const meta = {
  title: 'Pages/Programs/Builder',
  component: Page,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Page>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Saved: Story = { args: {} };
export const NewProgram: Story = { args: { saved: false, draft: true } };
export const ClientReview: Story = { args: { readOnly: true } };
