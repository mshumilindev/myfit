import type { Meta, StoryObj } from '@storybook/react-vite';
import { RequestCard } from './RequestCard';

const act = (label: string, ariaLabel: string) => ({ label, ariaLabel, onClick: () => undefined });

const meta = {
  title: 'Coach/RequestCard',
  component: RequestCard,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 520 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    title: 'Oleh asks to move a session',
    status: 'Needs your answer',
    kind: 'answer',
    fromLabel: 'From',
    from: 'Fri 9 Oct, 18:00',
    toLabel: 'To',
    to: 'Mon 12 Oct, 18:00',
    note: 'Work trip, back on Saturday.',
    accept: act('Accept', 'Accept move for Oleh'),
    decline: act('Decline', 'Decline move for Oleh'),
    propose: act('Propose another', 'Propose another time to Oleh'),
  },
} satisfies Meta<typeof RequestCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NeedsAnswer: Story = {};
export const Waiting: Story = {
  args: {
    kind: 'waiting',
    title: 'You asked Maria to move a session',
    status: 'Waiting for Maria',
    note: undefined,
    cancel: act('Cancel request', 'Cancel request to Maria'),
  },
};
export const Sending: Story = { args: { busy: true } };
export const Answered: Story = {
  args: { resultText: 'Accepted. Oleh gets the new time in chat.' },
};
export const Failed: Story = {
  args: { errorText: 'Could not send the answer. It stays on the list, try again.' },
};
