import type { Meta, StoryObj } from '@storybook/react-vite';
import { CallActions } from './CallActions';
import { noop } from '../../stories/callFixtures';

const meta = {
  title: 'Kit/CallActions',
  component: CallActions,
  args: { voiceLabel: 'Voice call', videoLabel: 'Video call', onVoice: noop, onVideo: noop },
} satisfies Meta<typeof CallActions>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
export const Offline: Story = { args: { disabledReason: 'Offline' } };
