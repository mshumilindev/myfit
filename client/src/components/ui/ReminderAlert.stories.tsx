import type { Meta, StoryObj } from '@storybook/react-vite';
import { ReminderAlert, type ReminderAlertProps } from './ReminderAlert';

/** The reminder that rings (kit group Alert): a whole phone screen or a desktop card, in four states. App-agnostic. */
const labels: ReminderAlertProps['labels'] = {
  snooze: 'Snooze',
  dismiss: 'Dismiss',
  close: 'Close',
  minutes: (n) => `${n} min`,
  doneTitle: 'Dismissed on another device',
  doneBody: 'You do not need to do anything here.',
};
const meta = {
  title: 'Kit/ReminderAlert',
  component: ReminderAlert,
  parameters: { layout: 'fullscreen' },
  args: {
    variant: 'screen',
    state: 'ringing',
    title: 'Physio visit',
    icon: 'first-aid',
    tone: 'accent',
    kind: 'Reminder · in 1 h',
    sub: 'Today at 14:30',
    labels,
  },
  decorators: [
    (Story) => (
      <div style={{ minHeight: 640, background: 'var(--color-bg)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ReminderAlert>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Ringing: snooze lengths and Dismiss. */
export const Ringing: Story = {};

/** Snoozed: the reminder will come back. */
export const Snoozed: Story = { args: { state: 'snoozed' } };

/** Dismissed on another device. */
export const Elsewhere: Story = { args: { state: 'elsewhere' } };

/** Ringing is not possible on this platform. */
export const Unavailable: Story = { args: { state: 'unavailable' } };

/** Desktop: a floating card over the app. */
export const Card: Story = { args: { variant: 'card' } };
