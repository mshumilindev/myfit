import type { Meta, StoryObj } from '@storybook/react-vite';
import { TeamInviteSignInNote } from './TeamInviteSignInNotice';

/** Sign-in screen note for a team link (SPO-284): who invited the person, and what to do without an account. */
const meta = {
  title: 'Pages/Coach/JoinTeamSignInNote',
  component: TeamInviteSignInNote,
  decorators: [
    (Story) => (
      <div className="auth-card">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TeamInviteSignInNote>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Manager: Story = { args: { role: 'manager', invitedByName: 'Olena Kovalenko' } };
export const Trainer: Story = { args: { role: 'trainer', invitedByName: 'Andriy Petrenko' } };
