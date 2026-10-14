import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Chip } from './Chip';
import { IconButton } from './Button';
import { ChatComposer, type ChatComposerProps } from './ChatComposer';

const base: Omit<ChatComposerProps, 'value' | 'onChange'> = {
  placeholder: 'Write to Oleh',
  sendLabel: 'Send',
  emptyReason: 'Write a message to send it',
  onSend: () => undefined,
  footnote: 'Messages are encrypted on your device and stored encrypted.',
};

function Live(props: Partial<ChatComposerProps> & { initial?: string }) {
  const [v, setV] = useState(props.initial ?? '');
  return (
    <div style={{ maxWidth: 560 }}>
      <ChatComposer {...base} {...props} value={v} onChange={setV} />
    </div>
  );
}

const meta = {
  title: 'Coach/Chat composer',
  component: ChatComposer,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ChatComposer>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { ...base, value: '', onChange: () => undefined },
  render: () => <Live />,
};
export const WithText: Story = {
  args: { ...base, value: '', onChange: () => undefined },
  render: () => <Live initial="Same plan on Wednesday." />,
};
export const MultiLine: Story = {
  args: { ...base, value: '', onChange: () => undefined },
  render: () => <Live initial={'One\nTwo\nThree\nFour\nFive\nSix\nSeven'} />,
};
export const TooLong: Story = {
  args: { ...base, value: '', onChange: () => undefined },
  render: () => (
    <Live
      initial={'x'.repeat(30)}
      maxLength={20}
      tooLongText="Too long. The limit is 20 characters."
    />
  ),
};
export const Blocked: Story = {
  args: { ...base, value: '', onChange: () => undefined },
  render: () => <Live initial="Hello" blockedReason="Secure chat is locked. Retry in a moment." />,
};
/** Slots for later milestones: a Share button and chips (Private note, Request reschedule). */
export const WithSlots: Story = {
  args: { ...base, value: '', onChange: () => undefined },
  render: () => (
    <Live
      lead={<IconButton icon="share-network" label="Share" variant="secondary" shape="round" />}
      chips={
        <>
          <Chip>Private note</Chip>
          <Chip>Request reschedule</Chip>
        </>
      }
    />
  ),
};
