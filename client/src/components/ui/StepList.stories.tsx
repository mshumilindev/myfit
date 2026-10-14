import type { Meta, StoryObj } from '@storybook/react-vite';
import { StepList } from './StepList';

const meta = {
  title: 'Coach/StepList',
  component: StepList,
  args: {
    label: 'What happens next',
    items: [
      { id: 'p', icon: 'barbell', title: 'Program', body: 'Bench press: 3 to 4 sets.' },
      {
        id: 'r',
        icon: 'timer',
        title: 'Result check',
        body: 'In 14 days. Counted as improved only if estimated 1RM moves by 2.5 kg or more.',
      },
      {
        id: 's',
        icon: 'eye',
        title: 'Oleh sees',
        body: 'The new version of the program in the app.',
      },
      { id: 'm', icon: 'envelope', title: 'Message to Oleh', body: '“Hi Oleh, quick question…”' },
    ],
  },
} satisfies Meta<typeof StepList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
