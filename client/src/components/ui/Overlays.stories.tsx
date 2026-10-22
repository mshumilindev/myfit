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

/** Colour-coded drawer: the whole sheet takes a tone family (here warm-up blue). */
export const SheetWarmupTone: Story = {
  name: 'Sheet · warm-up tone',
  args: { onClose: () => undefined, padded: true, tone: 'warmup', children: 'Sheet content' },
  render: (args) => <SheetDemo {...args} />,
};

/** Bottom sheet with grabber; drag to resize / dismiss. */
export const SheetStory: Story = {
  name: 'Sheet',
  args: { onClose: () => undefined, padded: true, children: 'Sheet content' },
  render: (args) => <SheetDemo {...args} />,
};

/** `dismissible={false}`: no close button, the scrim, Escape and the grabber swipe do nothing (the legal gate). */
export const SheetNotDismissible: Story = {
  name: 'Sheet · not dismissible',
  args: {
    onClose: () => undefined,
    padded: true,
    dismissible: false,
    role: 'alertdialog',
    label: 'Blocking prompt',
    children: 'Answer with the buttons inside the sheet.',
  },
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

/** R-KIT-02: an extra choice under the body (unchecked by default). A phone shows every confirm as a bottom sheet. */
export const ConfirmWithCheckbox: Story = {
  args: { onClose: () => undefined, children: null },
  render: function Render() {
    const [on, setOn] = useState(false);
    return (
      <ConfirmDialog
        title="Delete thread?"
        body="The messages leave this device."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        checkbox={{ label: 'Also delete my notes', checked: on, onChange: setOn }}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />
    );
  },
};

/** R-KIT-02: fine print (13px) under the choice. */
export const ConfirmFineprint: Story = {
  args: { onClose: () => undefined, children: null },
  render: () => (
    <ConfirmDialog
      title="Stop sharing?"
      body="Your trainer stops seeing new sessions."
      confirmLabel="Stop sharing"
      cancelLabel="Keep sharing"
      danger
      fineprint="Past sessions stay with your trainer until you end coaching."
      onConfirm={() => undefined}
      onCancel={() => undefined}
    />
  ),
};

/** R-KIT-02: the confirm shows the kit spinner and ignores a second tap. */
export const ConfirmLoading: Story = {
  args: { onClose: () => undefined, children: null },
  render: () => (
    <ConfirmDialog
      title="Delete workout?"
      body="This cannot be undone."
      confirmLabel="Delete"
      cancelLabel="Cancel"
      danger
      loading
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
