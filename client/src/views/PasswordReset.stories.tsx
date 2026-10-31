import type { Meta, StoryObj } from '@storybook/react-vite';
import { PageFrame } from '../stories/PageFrame';
import { ForgotPasswordView } from './ForgotPasswordView';
import { ResetPasswordView } from './ResetPasswordView';

/** The forgot-password flow (SPO-225): the request form and the screens a reset link opens. */
const meta = {
  title: 'Pages/PasswordReset',
  component: ResetPasswordView,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <PageFrame>
        <Story />
      </PageFrame>
    ),
  ],
  args: { token: 'story', live: true, onSignIn: () => undefined, onNewLink: () => undefined },
} satisfies Meta<typeof ResetPasswordView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NewPassword: Story = {};
export const DeadLink: Story = { args: { live: false } };
export const Request: Story = {
  render: () => <ForgotPasswordView onBack={() => undefined} />,
};
