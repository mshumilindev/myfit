import { useEffect, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { buildFixtureWorld, createFixturesPort, FIXTURE_NOW } from '../data/__fixtures__/fixtures';
import { deriveWorld } from '../data/deriveWorld';
import type { CoachWorldPort, WorldData } from '../data/port';
import { recordProgramDecision, snoozeSignal } from '../domain/decisions';
import { buildOptions } from '../domain/diff';
import { TodayScreen } from './TodayScreen';
import { createFixturesTeamPort } from '../team/__fixtures__/fixtures';
import { configureTeam } from '../team/useTeam';

/** Same padding and scroll as the shell's main column. */
function Frame({ children, hash }: { children: ReactNode; hash: string }) {
  useState(() => {
    try {
      window.history.replaceState(null, '', hash);
    } catch {
      /* sandboxed frame */
    }
    return null;
  });
  useEffect(() => {
    // The real shell puts the Coach accent on <html> so portaled drawers and popovers match.
    document.documentElement.classList.add('theme-coach');
    return () => document.documentElement.classList.remove('theme-coach');
  }, []);
  return (
    <div
      className="app-coach"
      style={{
        position: 'fixed',
        inset: 0,
        overflowX: 'hidden',
        overflowY: 'auto',
        padding: 'var(--co-gut) var(--co-pad)',
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
      }}
    >
      {children}
    </div>
  );
}

const meta = {
  title: 'Pages/Coach/Agenda',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const OPTS = { refreshEveryMs: 0 };
const noop = () => undefined;

function view(hash: string, port: CoachWorldPort = createFixturesPort()) {
  return (
    <Frame hash={hash}>
      <TodayScreen port={port} worldOptions={OPTS} onNavigate={noop} />
    </Frame>
  );
}

const stallKey = () => {
  const d = buildFixtureWorld();
  return deriveWorld(d, d.book, FIXTURE_NOW).signals.find((s) => s.signal.kind === 'stall')!.signal;
};

function withData(patch: (d: WorldData) => WorldData): CoachWorldPort {
  const base = createFixturesPort();
  const data = patch(buildFixtureWorld());
  return { ...base, peek: () => ({ data, fetchedAt: FIXTURE_NOW }), load: async () => data };
}

export const ByPriority: Story = { render: () => view('#/c/agenda') };
export const MoreInDigest: Story = { render: () => view('#/c/agenda') };
export const AllClear: Story = {
  render: () =>
    view(
      '#/c/agenda',
      withData((d) => ({ ...d, inputs: [] })),
    ),
};
export const PipelineByStage: Story = { render: () => view('#/c/agenda?view=stage') };
export const PipelineDrawer: Story = {
  render: () => view(`#/c/agenda?view=stage&open=${encodeURIComponent(stallKey().key)}`),
};
export const Loading: Story = {
  render: () => view('#/c/agenda', createFixturesPort({ delayMs: 600_000 })),
};
export const Stale: Story = {
  render: () => view('#/c/agenda', createFixturesPort({ warm: true, delayMs: 600_000 })),
};
export const Offline: Story = {
  render: () => view('#/c/agenda', createFixturesPort({ warm: true, failWith: () => 'offline' })),
};
export const ErrorState: Story = {
  render: () => view('#/c/agenda', createFixturesPort({ failWith: () => 'unavailable' })),
};
export const Phone: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: () => view('#/c/agenda'),
};
export const PhoneByStage: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: () => view('#/c/agenda?view=stage'),
};

const decisionHash = () => `#/c/agenda?decision=${encodeURIComponent(stallKey().key)}`;
export const Decision: Story = { render: () => view(decisionHash()) };
export const DecisionPhone: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: () => view(decisionHash()),
};
export const DecisionRecorded: Story = {
  render: () =>
    view(
      decisionHash(),
      withData((d) => {
        const s = stallKey();
        const opt = buildOptions(s).find((o) => o.id === 'variation')!;
        return {
          ...d,
          book: recordProgramDecision(d.book, {
            id: 'story-rec',
            signal: s,
            option: opt,
            now: FIXTURE_NOW,
            message: 'Hi Oleh, quick question: how are you sleeping and eating this week?',
          }),
        };
      }),
    ),
};
export const DecisionSnoozed: Story = {
  render: () =>
    view(
      decisionHash(),
      withData((d) => ({ ...d, book: snoozeSignal(d.book, 'story-snz', stallKey(), FIXTURE_NOW) })),
    ),
};

/** A manager asked to remove a client (SPO-204, board D8): the "Team requests" section above the reschedule requests. */
function TeamRequestsStory() {
  useState(() => {
    configureTeam(createFixturesTeamPort({ withRequests: true, delayMs: 0 }));
    return null;
  });
  useEffect(() => () => configureTeam(null), []);
  return view('#/c/agenda');
}
export const TeamRequests: Story = { render: () => <TeamRequestsStory /> };
