import type { Meta, StoryObj } from '@storybook/react-vite';
import { InfoTable } from './InfoTable';

const meta = {
  title: 'Coach/InfoTable',
  component: InfoTable,
  args: {
    label: 'Client facts',
    rows: [
      { id: 'status', label: 'Status', value: 'On track' },
      { id: 'program', label: 'Program', value: 'Strength block, week 3' },
      { id: 'week', label: 'This week', value: '2 of 3 sessions' },
      { id: 'last', label: 'Last session', value: 'Yesterday' },
      { id: 'shares', label: 'Shares with you', value: 'Workout totals, Sets and weights' },
      { id: 'restriction', label: 'Restriction', value: 'Not shared' },
    ],
  },
} satisfies Meta<typeof InfoTable>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
