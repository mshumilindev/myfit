import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';
import { ConsentPrompt, type ConsentPromptProps } from './ConsentPrompt';
import { AcceptCheck, DocReadList } from './DocReadList';
import { LegalLinks } from './LegalLinks';
import { canAccept, useDocReadGate } from './docReadGate';

const facts = [
  {
    icon: 'chat-circle-text',
    label: 'What is sent',
    sub: 'Your question and the context it needs',
    tone: 'atlas' as const,
  },
  { icon: 'buildings', label: 'Who receives it', sub: 'Google, as our processor' },
  { icon: 'clock', label: 'How long', sub: 'Not used to train models' },
];

const args: ConsentPromptProps = {
  icon: 'sparkle',
  tone: 'atlas',
  title: 'Turn on Atlas AI?',
  lead: 'Atlas answers with a model run by a provider. Your question leaves Spotter to get an answer.',
  facts,
  factsLabel: 'Details',
  primary: 'Turn on',
  secondary: 'Not now',
  closeLabel: 'Close',
  foot: 'You can turn it off any time in Privacy.',
  onPrimary: () => undefined,
  onSecondary: () => undefined,
};

const meta = {
  title: 'Kit/ConsentPrompt',
  component: ConsentPrompt,
  parameters: { layout: 'fullscreen' },
  args,
} satisfies Meta<typeof ConsentPrompt>;
export default meta;
type Story = StoryObj<typeof meta>;

function Host(p: ConsentPromptProps) {
  const [open, setOpen] = useState(true);
  const close = () => setOpen(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open prompt</Button>
      {open && <ConsentPrompt {...p} onPrimary={close} onSecondary={close} />}
    </>
  );
}

export const Default: Story = { render: (a) => <Host {...a} /> };

/** The affirmative button locked (waiting on a read-and-accept box). */
export const PrimaryDisabled: Story = {
  args: { primaryDisabled: true },
  render: (a) => <Host {...a} />,
};

/** Long text must wrap, never clip (pl / lt / et run 30-60% longer). */
export const LongText: Story = {
  args: {
    title: 'Įjungti Atlas dirbtinį intelektą ir pasidalyti duomenimis su teikėju?',
    lead: 'Atlas atsako naudodamas teikėjo modelį; jūsų klausimas palieka Spotter, kad gautumėte atsakymą, ir gali būti apdorojamas už Europos ekonominės erdvės ribų.',
    primary: 'Sutinku ir įjungti',
    secondary: 'Ne dabar',
  },
  render: (a) => <Host {...a} />,
};

function WithGate(p: ConsentPromptProps) {
  const gate = useDocReadGate(['terms', 'privacy']);
  const [agree, setAgree] = useState(false);
  return (
    <ConsentPrompt
      {...p}
      primaryDisabled={!canAccept(gate.allOpened, [agree])}
      before={
        <>
          <DocReadList
            docs={[
              { id: 'terms', label: 'Terms of Use' },
              { id: 'privacy', label: 'Privacy Policy' },
            ]}
            opened={gate.opened}
            onOpen={gate.markOpened}
            notOpenedLabel="Not opened yet"
            readLabel="Read"
            lockedHint="Open both documents to unlock the box below."
          />
          <AcceptCheck checked={agree} disabled={!gate.allOpened} onChange={setAgree}>
            I have read the documents and agree.
          </AcceptCheck>
          <LegalLinks label="Legal" privacyLabel="Privacy Policy" termsLabel="Terms of Use" />
        </>
      }
    />
  );
}

/** Read gate: open both rows, tick the box, then the primary unlocks. */
export const WithReadGate: Story = { render: (a) => <WithGate {...a} /> };
