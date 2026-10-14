import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConfirmEffectsDialog, type ConfirmEffectsDialogProps } from './ConfirmEffectsDialog';

const meta = {
  title: 'Coach/Confirm dialog',
  component: ConfirmEffectsDialog,
  parameters: { layout: 'fullscreen' },
  args: {
    title: 'Delete this message?',
    body: 'This removes it for you and for Oleh. A small line stays in the chat.',
    quote:
      'Thanks for telling me. This week I will swap the dumbbell press for a 30 degree incline press.',
    effects: [{ icon: 'eye-slash', text: 'You and Oleh stop seeing the text' }],
    small: 'You can undo for 8 seconds. After that it cannot be restored.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    onConfirm: () => undefined,
    onCancel: () => undefined,
  },
} satisfies Meta<typeof ConfirmEffectsDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const DeleteMessage: Story = {};

/** With the optional extra choice, unchecked by default. */
export const ClearChat: Story = { render: (args) => <ClearChatDemo {...args} /> };

function ClearChatDemo(args: ConfirmEffectsDialogProps) {
  const [also, setAlso] = useState(false);
  return (
    <ConfirmEffectsDialog
      {...args}
      title="Clear this chat?"
      body="This clears the chat on your side only. Oleh keeps their copy and can still read everything."
      quote={undefined}
      effects={[
        { icon: 'eye-slash', text: 'You stop seeing 12 messages' },
        { icon: 'lock-simple', text: 'Oleh keeps every message' },
      ]}
      check={{ label: 'Also delete my 3 notes about Oleh', checked: also, onChange: setAlso }}
      confirmLabel="Clear chat"
    />
  );
}
