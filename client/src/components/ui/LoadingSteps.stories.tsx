import type { Meta, StoryObj } from '@storybook/react-vite';
import { LoadingSteps } from './LoadingSteps';

const meta = {
  title: 'Kit/LoadingSteps',
  component: LoadingSteps,
  args: {
    brand: <strong className="ut-xl">spotter</strong>,
    hint: 'This only takes a few seconds.',
    steps: [
      { id: 'in', label: 'Signed in', state: 'done' },
      { id: 'check', label: 'Checking your agreement', state: 'active' },
      { id: 'open', label: 'Opening Spotter', state: 'todo' },
    ],
  },
} satisfies Meta<typeof LoadingSteps>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Checking: Story = {};
export const Opening: Story = {
  args: {
    steps: [
      { id: 'in', label: 'Signed in', state: 'done' },
      { id: 'rec', label: 'Agreement recorded', state: 'done' },
      { id: 'open', label: 'Opening Spotter', state: 'active' },
    ],
  },
};
