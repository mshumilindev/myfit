import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';
import { DecisionRecord } from './DecisionRecord';

const STEPS = [
  { id: 'what', icon: 'pulse', title: 'What happened', body: 'Stall: Bench press' },
  {
    id: 'ev',
    icon: 'magnifying-glass',
    title: 'Evidence',
    body: 'Bench press: 114 to 116 kg across 3 entries.',
  },
  { id: 'dec', icon: 'check-circle', title: 'Decision', body: 'Add a 4th back set, drop biceps' },
  { id: 'res', icon: 'target', title: 'Result', body: 'No move that counts over 14 days.' },
];

/** Coach kit: one decision, its outcome and its follow-up window. */
const meta = {
  title: 'Coach/Decision record',
  component: DecisionRecord,
  parameters: { layout: 'padded' },
  args: {
    avatar: <span style={{ width: 40, height: 40 }} aria-hidden />,
    name: 'Oleh Bondar',
    sub: 'Upper/Lower 4x · decided 16 Sep',
    result: { label: 'No clear change', tone: 'neutral' },
    stepsLabel: 'How the decision went',
    steps: STEPS,
    followUp: {
      title: '14-day follow-up',
      status: 'Closed',
      value: 100,
      tone: 'ok',
      progressLabel: 'Days measured so far',
      notes: [
        'Measured over 14 days. The evidence is saved as it was when you decided.',
        'Improved means at least 2.5 kg better. A smaller move reads No clear change.',
      ],
    },
    actions: (
      <>
        <Button variant="primary" iconTrailing="arrow-right">
          Open evidence
        </Button>
        <Button variant="secondary" icon="plus">
          New decision
        </Button>
      </>
    ),
    footnote: 'Oleh sees the decision and its result, never your private notes.',
  },
  decorators: [
    (S) => (
      <div style={{ maxWidth: 560 }}>
        <S />
      </div>
    ),
  ],
} satisfies Meta<typeof DecisionRecord>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};
export const Measuring: Story = {
  args: {
    result: { label: 'Measuring', tone: 'rest', icon: 'hourglass' },
    followUp: {
      title: '14-day follow-up',
      status: 'Day 4 of 14',
      value: 29,
      tone: 'accent',
      progressLabel: 'Days measured so far',
      notes: ['The result is final on day 14; until then it reads Measuring.'],
    },
  },
};
export const NoFollowUp: Story = { args: { followUp: undefined } };
