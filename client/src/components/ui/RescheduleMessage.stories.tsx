import type { Meta, StoryObj } from '@storybook/react-vite';
import { RescheduleMessage } from './RescheduleMessage';

const act = (label: string, ariaLabel?: string) => ({ label, ariaLabel, onClick: () => undefined });

const meta = {
  title: 'Coach/Reschedule card',
  component: RescheduleMessage,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 440 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    status: 'pending',
    kindLabel: 'Reschedule request',
    statusLabel: 'Needs your answer',
    title: 'Oleh asks to move a session',
    session: { bold: 'Upper B', rest: ' · 60 min · Iron Yard' },
    from: { label: 'Now', day: 'Fri 9 Oct', time: '18:00' },
    to: { label: 'Proposed', day: 'Sat 10 Oct', time: '10:00' },
    note: 'Work trip, back on Saturday.',
    accept: act('Accept', 'Accept the request from Oleh'),
    decline: act('Decline', 'Decline the request from Oleh'),
    counter: act('Suggest another time'),
  },
} satisfies Meta<typeof RescheduleMessage>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Incoming: the viewer answers with Accept / Decline / Suggest another time. */
export const Incoming: Story = {};
export const Waiting: Story = {
  args: {
    mine: true,
    statusLabel: 'Waiting for Oleh',
    title: 'You asked Oleh to move a session',
    accept: undefined,
    decline: undefined,
    counter: undefined,
    waiting: {
      text: 'The session stays on Fri 9 Oct at 18:00 until Oleh answers.',
      cancel: act('Cancel request'),
    },
  },
};
export const Accepted: Story = {
  args: {
    status: 'accepted',
    statusLabel: 'Accepted',
    from: { label: 'Was', day: 'Fri 9 Oct', time: '18:00', struck: true },
    to: { label: 'Now', day: 'Sat 10 Oct', time: '10:00' },
    outcome: { text: 'The session moved to Sat 10 Oct at 10:00.', when: 'Today 08:55' },
    followUp: act('Open calendar'),
  },
};
export const Declined: Story = {
  args: {
    status: 'declined',
    mine: true,
    statusLabel: 'Declined',
    title: 'You asked Sofiia to move a session',
    session: { bold: 'Group session · Mobility class', rest: ' · 5 people · 60 min · Iron Yard' },
    outcome: { text: 'Sofiia declined. The session has not moved.', when: 'Declined today 08:55' },
    followUp: act('Propose a new time'),
  },
};
export const Expired: Story = {
  args: {
    status: 'expired',
    statusLabel: 'Expired',
    outcome: { text: 'Nobody answered in time. The session stays on Fri 9 Oct at 18:00.' },
    followUp: act('Propose a new time'),
  },
};
export const Cancelled: Story = {
  args: {
    status: 'cancelled',
    mine: true,
    statusLabel: 'Cancelled',
    outcome: { text: 'Request withdrawn. The session stays on Fri 9 Oct at 18:00.' },
  },
};
export const Countered: Story = {
  args: {
    status: 'countered',
    statusLabel: 'Other time suggested',
    outcome: { text: 'A new time was suggested in a later request.' },
  },
};
export const Sending: Story = { args: { busy: true, errorText: undefined } };
export const Failed: Story = { args: { errorText: "Couldn't send your answer. Try again." } };
