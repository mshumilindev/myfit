import type { Meta, StoryObj } from '@storybook/react-vite';
import { DecisionCard } from './DecisionCard';
import { EvidenceChart } from './EvidenceChart';

const chart = (
  <EvidenceChart
    tone="flag"
    unit="Estimated 1RM, kg"
    xStart="7 weeks ago"
    xEnd="This week"
    ariaLabel="Estimated 1RM 111 to 116 kg over 7 weeks, flat for 4"
    points={[111, 113, 115, 116, 116, 115, 116].map((v, i) => ({ label: `w${i}`, value: v }))}
  />
);

const meta = {
  title: 'Coach/DecisionCard',
  component: DecisionCard,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    clientName: 'Oleh Bondar',
    clientSub: 'Upper/Lower 4× · week 6',
    messageLabel: 'Message Oleh',
    tags: [{ label: 'Urgent', tone: 'danger' }, { label: 'Confidence High' }, { label: 'New' }],
    title: 'Bench press has not moved in 4 weeks',
    body: 'Estimated 1RM stayed at 116 kg for 4 weeks, with steady volume. Same exercise, same setup.',
    hero: { label: 'Bench press est. 1RM', value: '116', unit: 'kg', sub: 'no change in 4 weeks' },
    chart,
    primary: { label: 'Add a variation + 1 set', onClick: () => undefined },
    effect: 'Adds 1 × 5 Paused bench press. Checked again in 14 days.',
    evidence: { label: 'See evidence and options', onClick: () => undefined },
    others: { label: '2 other options', expanded: false, onClick: () => undefined },
  },
} satisfies Meta<typeof DecisionCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const NoChart: Story = {
  args: { hero: undefined, chart: undefined, primary: undefined, effect: undefined },
};
export const Busy: Story = {
  args: { primary: { label: 'Recording', onClick: () => undefined, busy: true } },
};
