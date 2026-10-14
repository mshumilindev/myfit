import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconButton } from './Button';
import { MessageMenu, type MessageMenuItem } from './MessageMenu';

const mine: MessageMenuItem[] = [
  { id: 'copy', icon: 'copy', label: 'Copy', onSelect: () => undefined },
  { id: 'del', icon: 'trash', label: 'Delete message', danger: true, onSelect: () => undefined },
];
const theirs: MessageMenuItem[] = [
  { id: 'copy', icon: 'copy', label: 'Copy', onSelect: () => undefined },
  {
    id: 'del',
    icon: 'trash',
    label: 'Delete message',
    disabled: true,
    hint: 'Only Oleh can delete this',
    onSelect: () => undefined,
  },
];

function Demo({
  items,
  rule,
  preview,
}: {
  items: MessageMenuItem[];
  rule?: string;
  preview?: string;
}) {
  const [open, setOpen] = useState(true);
  const ref = useRef<HTMLSpanElement>(null);
  return (
    <div style={{ minHeight: 280, display: 'flex', justifyContent: 'flex-end' }}>
      <span ref={ref}>
        <IconButton
          icon="dots-three"
          label="Message actions"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        />
      </span>
      <MessageMenu
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={ref}
        label="Message actions"
        items={items}
        rule={rule}
        preview={preview}
      />
    </div>
  );
}

const meta = {
  title: 'Coach/Message menu',
  component: MessageMenu,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof MessageMenu>;
export default meta;
type Story = StoryObj<typeof meta>;
const noop = {
  open: false,
  onClose: () => undefined,
  anchorRef: { current: null },
  label: 'Message actions',
  items: [],
};

/** Own message: Copy and Delete. A popover from 768 px up, a bottom sheet below (resize to see both). */
export const OwnMessage: Story = {
  args: noop,
  render: () => (
    <Demo
      items={mine}
      rule="You can delete only your own messages. It disappears for you and Oleh."
      preview="Thanks for telling me. This week we swap it."
    />
  ),
};
/** Their message: Delete is disabled and says why once. */
export const TheirMessage: Story = {
  args: noop,
  render: () => (
    <Demo
      items={theirs}
      rule="You can delete only your own messages."
      preview="My left shoulder is sore again."
    />
  ),
};
