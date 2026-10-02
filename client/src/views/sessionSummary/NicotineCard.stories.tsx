import type { Meta, StoryObj } from '@storybook/react-vite';
import { NicotineCard } from './NicotineCard';
import { atDay, seedStore } from '../../stories/fixtures';
import { __getStateForTests, __replaceStateForTests } from '../../store';
import { defaultNicotineSettings, newNicotineProduct } from '../../nicotine';
import type { NicotineProduct, Workout } from '../../types';

/** Session summary › "Without nicotine" (boards 4A, 4E): ranges in the user's own numbers. */
const meta = {
  title: 'Pages/Session summary/Without nicotine',
  component: NicotineCard,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof NicotineCard>;
export default meta;
type Story = StoryObj<typeof meta>;

const squat = (id: string, daysAgo: number): Workout => ({
  id,
  startedAt: atDay(-daysAgo, 18),
  finishedAt: atDay(-daysAgo, 19),
  autoFinished: false,
  exercises: [
    {
      id: `e-${id}`,
      name: 'Barbell Squat',
      position: 0,
      kind: 'strength',
      primaryMuscle: 'quads',
      sets: Array.from({ length: 4 }, (_, i) => ({
        id: `${id}-${i}`,
        reps: 5,
        weight: 100,
        isWarmup: false,
        position: i,
      })),
    },
  ],
});
const current = squat('today', 0);

const vape: NicotineProduct = {
  ...newNicotineProduct('vape', 'v'),
  unit: 'ml',
  amount: 1.5,
  strengthMg: 20,
};
const heated: NicotineProduct = {
  ...newNicotineProduct('heated', 'h'),
  unit: 'sticks',
  amount: 8,
  strengthMg: 1,
};

function seed(products: NicotineProduct[], history: Workout[]) {
  seedStore({ workouts: history });
  __replaceStateForTests({
    ...__getStateForTests(),
    nicotine: { products, settings: defaultNicotineSettings(), updatedAt: 1 },
  });
}

/** Three lines: recovery, top set, sleep (history and nights from the user's own data). */
export const AllLines: Story = {
  args: { workout: current },
  beforeEach: () => seed([vape, heated], [squat('a', 3), squat('b', 6), squat('c', 9)]),
};

/** A new user: no history yet, so only the top-set line has data. */
export const TopSetOnly: Story = {
  args: { workout: current },
  beforeEach: () => seed([vape, heated], []),
};

/** No products: the card is not shown at all. */
export const HiddenWithoutNicotine: Story = {
  args: { workout: current },
  beforeEach: () => seed([], [squat('a', 3)]),
};
