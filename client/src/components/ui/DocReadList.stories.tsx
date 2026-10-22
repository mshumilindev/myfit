import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';
import { AcceptCheck, DocReadList } from './DocReadList';
import { canAccept, useDocReadGate } from './docReadGate';

const docs = [
  { id: 'terms', label: 'Terms of Use' },
  { id: 'privacy', label: 'Privacy Policy' },
];
const text = {
  header: 'Before you continue',
  lockedHint: 'Open both documents and read them to unlock the boxes below.',
  notOpenedLabel: 'Not opened yet',
  readLabel: 'Read',
};

const meta = {
  title: 'Kit/DocReadList',
  component: DocReadList,
  args: { docs, opened: {}, onOpen: () => undefined, ...text },
} satisfies Meta<typeof DocReadList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NotOpened: Story = {};
export const OneRead: Story = { args: { opened: { terms: true } } };
export const AllRead: Story = { args: { opened: { terms: true, privacy: true } } };

function Flow({ ready }: { ready?: boolean }) {
  const gate = useDocReadGate(['terms', 'privacy']);
  const [adult, setAdult] = useState(false);
  const [agree, setAgree] = useState(false);
  const open = ready ? { terms: true, privacy: true } : gate.opened;
  const all = ready || gate.allOpened;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <DocReadList docs={docs} opened={open} onOpen={gate.markOpened} {...text} />
      <AcceptCheck checked={adult} disabled={!all} onChange={setAdult}>
        I am 18 or older.
      </AcceptCheck>
      <AcceptCheck checked={agree} disabled={!all} onChange={setAgree}>
        I agree to the Terms of Use and acknowledge the Privacy Policy.
      </AcceptCheck>
      <Button variant="primary" size="lg" disabled={!canAccept(all, [adult, agree])}>
        Continue
      </Button>
    </div>
  );
}

/** Registration step: Continue stays locked until both rows are opened and both boxes are ticked. */
export const RegistrationFlow: Story = { render: () => <Flow /> };
/** Documents read: boxes enabled, Continue still locked until both are ticked. */
export const BoxesUnlocked: Story = { render: () => <Flow ready /> };
export const LongLabels: Story = {
  args: {
    docs: [
      { id: 'terms', label: 'Trenerio paslaugų teikimo sąlygos ir duomenų tvarkymo sutartis' },
      docs[1],
    ],
  },
};
