import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';
import { StepConfirmDialog, type StepConfirmStepText } from './StepConfirmDialog';

const account: StepConfirmStepText[] = [
  {
    id: 'sure',
    title: 'Delete your account?',
    body: 'Everything Spotter holds about you will be removed.',
    effects: [
      { icon: 'barbell', text: 'Workouts and programs' },
      { icon: 'users', text: 'Your trainer stops seeing your data' },
    ],
    confirmLabel: 'Continue',
  },
  {
    id: 'copy',
    title: 'Keep a copy first?',
    body: 'Download your data before it goes. It cannot be recovered later.',
    confirmLabel: 'Continue',
  },
  {
    id: 'type',
    title: 'Type DELETE to confirm',
    body: 'This cannot be undone.',
    confirmLabel: 'Delete',
    typeWord: 'DELETE',
    typeLabel: 'Type DELETE',
  },
];

const meta = {
  title: 'Kit/StepConfirmDialog',
  component: StepConfirmDialog,
  parameters: { layout: 'fullscreen' },
  args: {
    steps: account,
    cancelLabel: 'Cancel',
    progressLabel: (i: number, n: number) => `Step ${i} of ${n}`,
    onConfirm: () => undefined,
    onCancel: () => undefined,
  },
} satisfies Meta<typeof StepConfirmDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

function Host(a: React.ComponentProps<typeof StepConfirmDialog>) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open</Button>
      {open && (
        <StepConfirmDialog
          {...a}
          onConfirm={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}

/** Three steps; the last one asks for a word and its button stays disabled until it matches. */
export const AccountThreeSteps: Story = { render: (a) => <Host {...a} /> };
export const HealthTwoSteps: Story = {
  args: { steps: account.slice(0, 2) },
  render: (a) => <Host {...a} />,
};
export const OneStep: Story = {
  args: {
    steps: [
      {
        id: 'chat',
        title: 'Clear Atlas chat?',
        body: 'The saved conversation on this device is removed.',
        confirmLabel: 'Clear',
      },
    ],
  },
  render: (a) => <Host {...a} />,
};
/** Straight to the typed word: the confirm is disabled. */
export const TypedWordOnly: Story = {
  args: { steps: [account[2]] },
  render: (a) => <Host {...a} />,
};
