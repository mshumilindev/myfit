import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';
import { ConfirmDialog, Dialog, Sheet, Toast, UndoSnackbar } from './Overlays';

const meta = {
  title: 'Kit/Overlays',
  component: Sheet,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Sheet>;
export default meta;
type Story = StoryObj<typeof meta>;

function SheetDemo(args: React.ComponentProps<typeof Sheet>) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open sheet</Button>
      {open && (
        <Sheet {...args} onClose={() => setOpen(false)}>
          <h3>Sheet title</h3>
          <p>Body copy inside a kit sheet.</p>
        </Sheet>
      )}
    </>
  );
}

/** Bottom sheet with grabber; drag to resize / dismiss. */
export const SheetStory: Story = {
  name: 'Sheet',
  args: { onClose: () => undefined, padded: true, children: 'Sheet content' },
  render: (args) => <SheetDemo {...args} />,
};

/** Centered dialog with actions; `danger` swaps the tone and icon. */
export const DialogStory: Story = {
  name: 'Dialog',
  args: { onClose: () => undefined, children: null },
  render: () => (
    <Dialog title="Rename gym" onClose={() => undefined} actions={<Button size="sm">Save</Button>}>
      Pick a new name.
    </Dialog>
  ),
};

export const Confirm: Story = {
  args: { onClose: () => undefined, children: null },
  render: () => (
    <ConfirmDialog
      title="Delete workout?"
      body="This cannot be undone."
      confirmLabel="Delete"
      cancelLabel="Cancel"
      danger
      onConfirm={() => undefined}
      onCancel={() => undefined}
    />
  ),
};

export const Undo: Story = {
  args: { onClose: () => undefined, children: null },
  render: () => (
    <UndoSnackbar
      snack={{ id: 1, text: 'Set deleted', onUndo: () => undefined }}
      onDone={() => undefined}
    />
  ),
};

export const ToastStory: Story = {
  name: 'Toast',
  args: { onClose: () => undefined, children: null },
  render: () => (
    <Toast
      toast={{ kind: 'ok', icon: 'check-circle', text: 'Saved' }}
      id={1}
      onExpire={() => undefined}
    />
  ),
};
