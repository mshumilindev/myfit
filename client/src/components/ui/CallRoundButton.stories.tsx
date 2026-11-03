import type { Meta, StoryObj } from '@storybook/react-vite';
import { CallRoundButton } from './CallRoundButton';
import { Row, Stack } from '../../stories/LocaleMatrix';
import { noop } from '../../stories/callFixtures';

const meta = {
  title: 'Kit/CallRoundButton',
  component: CallRoundButton,
  args: { icon: 'microphone', label: 'Mute', onClick: noop },
} satisfies Meta<typeof CallRoundButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Every tone at both sizes. */
export const TonesAndSizes: Story = {
  render: () => (
    <Stack>
      {(['md', 'lg'] as const).map((size) => (
        <Row key={size} gap={16}>
          <CallRoundButton size={size} icon="microphone" label="Mute" onClick={noop} />
          <CallRoundButton
            size={size}
            tone="light"
            icon="microphone-slash"
            label="Unmute"
            onClick={noop}
          />
          <CallRoundButton size={size} tone="ok" icon="phone" label="Answer" onClick={noop} />
          <CallRoundButton
            size={size}
            tone="danger"
            icon="phone-disconnect"
            label="End call"
            onClick={noop}
          />
        </Row>
      ))}
    </Stack>
  ),
};

export const Disabled: Story = { args: { disabled: true } };
export const LongLabel: Story = { args: { label: 'Przełącz kamerę na tylną' } };
