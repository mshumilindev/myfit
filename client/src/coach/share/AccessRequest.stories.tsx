import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, type ReactNode } from 'react';
import { ChatShell } from '../../components/ui/ChatShell';
import { setHealthConsentState, resetHealthGateForTests } from '../../data/healthConsentGate';
import { createFixturesClientPort } from '../client/data/__fixtures__/fixtures';
import { AccessAskForm } from '../client/screens/AccessAskForm';
import { AccessAskCard } from './AccessAskCard';
import { RequestAccessSheet } from './RequestAccessSheet';
import type { AccessAsk, AskStatus } from './accessAsk';
import '../client/ClientCoach.css';

/** "Request access" (SPO-99): the trainer's sheet, the chat card on both sides and the client's one-time form. Fixtures only. */
const meta = {
  title: 'Pages/Coach/Request access',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => undefined;
const SHARED = { totals: 'full', sets: 'effects' } as const;
const ALL_IDS = [
  'totals',
  'sets',
  'body',
  'sleep',
  'nutrition',
  'injury',
  'conditions',
  'nicotine',
  'alcohol',
  'supplements',
] as const;
const ask = (cats: AccessAsk['cats']): AccessAsk => ({ reqId: 'access-ask:1', cats });
const FUTURE = Date.UTC(2026, 9, 30, 10, 0);

export const TrainerSheet: Story = {
  render: () => <RequestAccessSheet first="Oleh" shared={SHARED} onSend={noop} onClose={noop} />,
};
export const TrainerSheetPicked: Story = {
  render: () => (
    <RequestAccessSheet
      first="Oleh"
      shared={SHARED}
      initial={['sleep', 'nutrition', 'conditions']}
      onSend={noop}
      onClose={noop}
    />
  ),
};
export const TrainerSheetNoApp: Story = {
  render: () => (
    <RequestAccessSheet first="Viktoriia" shared={{}} noApp onSend={noop} onClose={noop} />
  ),
};
export const TrainerSheetPaused: Story = {
  render: () => (
    <RequestAccessSheet
      first="Oleh"
      shared={SHARED}
      pause={{ blocked: true, until: FUTURE, reason: 'recent' }}
      onSend={noop}
      onClose={noop}
    />
  ),
};
export const TrainerSheetPausedAfterNotNow: Story = {
  render: () => (
    <RequestAccessSheet
      first="Oleh"
      shared={SHARED}
      pause={{ blocked: true, until: FUTURE, reason: 'declined' }}
      onSend={noop}
      onClose={noop}
    />
  ),
};
export const TrainerSheetNoChat: Story = {
  render: () => (
    <RequestAccessSheet first="Oleh" shared={SHARED} noChat onSend={noop} onClose={noop} />
  ),
};

const STATUSES: AskStatus[] = ['waiting', 'allowed', 'partial', 'declined', 'expired'];
const Thread = ({ children }: { children: ReactNode }) => (
  <ChatShell head={null}>
    <div className="ul-flex ul-col ug-12">{children}</div>
  </ChatShell>
);
export const CardsTrainerSide: Story = {
  render: () => (
    <Thread>
      {STATUSES.map((s) => (
        <AccessAskCard
          key={s}
          ask={ask(['sleep', 'nutrition', 'conditions'])}
          status={s}
          side="trainer"
          mine
          first="Oleh"
        />
      ))}
      <AccessAskCard ask={ask([...ALL_IDS])} status="waiting" side="trainer" mine first="Oleh" />
    </Thread>
  ),
};
export const CardsClientSide: Story = {
  render: () => (
    <Thread>
      {STATUSES.map((s) => (
        <AccessAskCard
          key={s}
          ask={ask(['sleep', 'nutrition', 'conditions'])}
          status={s}
          side="client"
          mine={false}
          first="Anna"
          onReview={noop}
        />
      ))}
    </Thread>
  ),
};

function Form({ cats, gated }: { cats: AccessAsk['cats']; gated?: boolean }) {
  const [port] = useState(() => createFixturesClientPort({ scenario: 'active' }));
  useState(() => {
    resetHealthGateForTests(true);
    if (gated)
      setHealthConsentState({
        on: {
          injuries: false,
          chronic: false,
          cycle: true,
          nicotine: true,
          alcohol: true,
          supplements: true,
          nutrition: true,
        },
        ready: true,
        answered: {
          injuries: true,
          chronic: true,
          cycle: true,
          nicotine: true,
          alcohol: true,
          supplements: true,
          nutrition: true,
        },
      });
  });
  return <AccessAskForm first="Anna" ask={ask(cats)} port={port} onDone={noop} onClose={noop} />;
}
export const ClientForm: Story = {
  render: () => <Form cats={['nutrition', 'conditions', 'alcohol']} />,
};
export const ClientFormEverything: Story = { render: () => <Form cats={[...ALL_IDS]} /> };
export const ClientFormNeedsHealthConsent: Story = {
  render: () => <Form cats={['injury', 'conditions', 'sleep']} gated />,
};
