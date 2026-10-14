import type { Meta, StoryObj } from '@storybook/react-vite';
import { EvidenceChart } from './EvidenceChart';

const meta = {
  title: 'Coach/EvidenceChart',
  component: EvidenceChart,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    unit: 'Estimated 1RM, kg',
    xStart: '7 weeks ago',
    xEnd: 'This week',
    ariaLabel: 'Estimated 1RM 111 to 116 kg over 7 weeks, flat for 4',
    points: [111, 113, 115, 116, 116, 115, 116].map((v, i) => ({ label: `w${i}`, value: v })),
  },
} satisfies Meta<typeof EvidenceChart>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Flat: Story = { args: { tone: 'flag' } };
export const Rising: Story = {
  args: { points: [100, 102, 104, 107, 110, 113].map((v, i) => ({ label: `w${i}`, value: v })) },
};
export const Noisy: Story = {
  args: { points: [115, 117, 114, 116, 114].map((v, i) => ({ label: `s${i}`, value: v })) },
};
export const Rhythm: Story = {
  args: {
    unit: 'Sessions per week',
    plan: 4,
    points: [4, 4, 3, 2, 1, 1].map((v, i) => ({ label: `w${i}`, value: v })),
  },
};
export const WithTable: Story = {
  args: {
    tableVisible: true,
    table: {
      caption: 'Evidence table',
      head: ['Date', 'Sets (kg × reps)', 'Est. 1RM'],
      rows: [
        ['6 Oct', '100 kg: 5, 5, 4 reps', '116 kg'],
        ['2 Oct', '100 kg: 5, 5, 5 reps', '117 kg'],
      ],
    },
  },
};
export const NotEnoughData: Story = {
  args: { points: [], empty: 'Not enough sessions yet (needs 3)' },
};
