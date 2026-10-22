import type { Meta, StoryObj } from '@storybook/react-vite';
import { PageFrame } from '../stories/PageFrame';
import { NotificationSettings } from './NotificationSettings';

/**
 * Notification settings (SPO-237, board C6 and the trainer / manager equivalents): quiet hours, then the Requests /
 * Reminders / Team switches. It is the same block in Profile > Settings for every role, so one story covers the three.
 */
const meta = {
  title: 'Pages/Notification settings',
  component: NotificationSettings,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <PageFrame>
        <div className="screen">
          <section className="profile-mobile-settings">
            <Story />
          </section>
        </div>
      </PageFrame>
    ),
  ],
} satisfies Meta<typeof NotificationSettings>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
