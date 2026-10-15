import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState, type ReactNode } from 'react';
import { clientEn as t } from '../../i18n/coachClient.en';
import { configureClientCoach } from './data/config';
import { createFixturesClientChatPort } from './data/__fixtures__/chat';
import { createFixturesClientPort, type ClientScenario } from './data/__fixtures__/fixtures';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import type { ProgramAssignment, ProgramItem } from '../../data/programMine';
import {
  ClientProgramExtras,
  ClientTargetStrip,
  ClientTodayExtras,
  ClientTrainerDayTag,
} from './ClientExtras';
import { AccessLogPage } from './screens/AccessLogPage';
import { ClientChat } from './screens/ClientChat';
import { InvitePages } from './screens/InvitePages';
import { MyTrainerPage } from './screens/MyTrainerPage';
import { TrainerSharing } from './screens/TrainerSharing';
import './ClientCoach.css';

/**
 * The client's side of the trainer link: invite pages (real onboarding frame), the sharing block on Privacy and
 * sharing, access log, My trainer, chat, and the Today additions. Fixtures only; no network.
 */
const meta = { title: 'Pages/Coach/Client', parameters: { layout: 'fullscreen' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => undefined;
const click = (label: string) => async () => {
  const b = await waitForButton(label);
  b?.click();
};
async function waitForButton(label: string): Promise<HTMLButtonElement | null> {
  for (let i = 0; i < 40; i++) {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.includes(label));
    if (b) return b as HTMLButtonElement;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

function Page({ children }: { children: ReactNode }) {
  return <div className="screen hl">{children}</div>;
}

/** Points the module-level adapters at this story's fixtures BEFORE the first render (the real hooks read them). */
function World({
  scenario,
  fail,
  children,
}: {
  scenario: ClientScenario;
  fail?: 'offline';
  children: ReactNode;
}) {
  useState(() => {
    configureClientCoach({
      port: createFixturesClientPort({ scenario, fail }),
      chat: createFixturesClientChatPort({ unread: scenario === 'none' ? 0 : 3 }),
    });
  });
  useEffect(() => () => configureClientCoach(), []);
  return <>{children}</>;
}

/** The onboarding frame is `height: 100%`: give it the viewport like the real overlay does. */
const Full = ({ children }: { children: ReactNode }) => (
  <div style={{ height: '100dvh' }}>{children}</div>
);

const invite = (token: string, fail?: 'offline'): Story => ({
  render: () => (
    <World scenario="none" fail={fail}>
      <Full>
        <InvitePages token={token} onExit={noop} />
      </Full>
    </World>
  ),
});

export const InviteLanding: Story = invite('ok1');
export const InviteShare: Story = { ...invite('ok2'), play: click(t.invAccept) };
export const InviteAccepted: Story = {
  ...invite('ok3'),
  play: async () => {
    await click(t.invAccept)();
    await click(t.invSave)();
  },
};
export const InviteExpired: Story = invite('expired1');
export const InviteUsed: Story = invite('used1');
export const InviteDeclined: Story = invite('declined1');
export const InviteOffline: Story = invite('ok4', 'offline');

const sharing = (
  scenario: ClientScenario,
  initial?: React.ComponentProps<typeof TrainerSharing>['initial'],
): Story => ({
  render: () => (
    <World scenario={scenario}>
      <Page>
        <div className="hl-cnt">
          <TrainerSharing
            force
            initial={initial}
            onStart={noop}
            onOpenLog={noop}
            onOpenTrainer={noop}
          />
        </div>
      </Page>
    </World>
  ),
});
export const SharingActive: Story = sharing('active');
export const SharingWaiting: Story = sharing('waiting');
export const SharingNone: Story = sharing('none');
export const SharingRevoked: Story = sharing('revoked');
export const SharingLevelSheet: Story = sharing('active', { sheet: 'sleep' });
export const SharingRevokeDialog: Story = sharing('active', { revoke: true });

const world = (scenario: ClientScenario, child: ReactNode): Story => ({
  render: () => <World scenario={scenario}>{child}</World>,
});

export const AccessLog: Story = world('active', <AccessLogPage onBack={noop} />);

const trainerPage = (
  <MyTrainerPage onBack={noop} onChat={noop} onSharing={noop} onProgram={noop} onLeft={noop} />
);
export const MyTrainer: Story = world('active', trainerPage);
export const MyTrainerNoProgram: Story = world('no-program', trainerPage);
/** The trainer card the app already showed (legacy `users.trainerId`) opened the real screens: nothing is shared until the member chooses. */
export const MyTrainerMigrated: Story = world('migrated', trainerPage);

const chat = (initial?: React.ComponentProps<typeof ClientChat>['initial']): Story =>
  world('active', <ClientChat onBack={noop} onOpenSharing={noop} initial={initial} />);
export const Chat: Story = chat();
export const ChatNotes: Story = chat({ notes: true });
export const ChatReschedule: Story = chat({ reschedule: true });

const today = (
  <Page>
    <ClientTodayExtras />
  </Page>
);
export const TodayWithTrainer: Story = world('active', today);
export const TodayCoachDays: Story = world('none', today);

/** ---- program extras, session strip, trainer-day tags (the member's program from the trainer) ---- */
const item = (
  id: string,
  day: number,
  position: number,
  name: string,
  extra: Partial<ProgramItem> = {},
): ProgramItem => ({
  id,
  day,
  position,
  name,
  kind: 'strength',
  sets: 3,
  reps: 8,
  durationMin: null,
  equipment: [],
  ...extra,
});
const ASSIGNMENT: ProgramAssignment = {
  program: {
    id: 'p-upper-lower',
    name: 'Upper / Lower 4x',
    weeks: 8,
    daysPerWeek: 4,
    dayNames: { '2': 'Upper A', '4': 'Lower A', '5': 'Upper B', '6': 'Lower B' },
    items: [
      item('i1', 2, 0, 'Paused Bench Press', {
        sets: 3,
        reps: 6,
        targetWeight: 82.5,
        targetRpe: 8,
        restSec: 150,
        note: 'Two second pause on the chest. Keep the shoulder blades tight.',
      }),
      item('i2', 2, 1, 'Incline Dumbbell Press', { bare: true, sets: 0, reps: 0 }),
      item('i3', 4, 0, 'Barbell Squat', {
        sets: 4,
        reps: 5,
        targetWeight: 120,
        targetRpe: 8,
        restSec: 150,
      }),
    ],
  },
  assignedBy: 'trainer-iryna',
  week: 4,
  done: 2,
  total: 4,
  expectedSoFar: 2,
  adherence: 1,
};

export const ProgramExtras: Story = world(
  'active',
  <Page>
    <ClientProgramExtras assignment={ASSIGNMENT} />
  </Page>,
);
export const ProgramExtrasNoTrainer: Story = world(
  'none',
  <Page>
    <ClientProgramExtras assignment={null} />
  </Page>,
);
export const SessionTargetStrip: Story = world(
  'active',
  <Page>
    <ClientTargetStrip exName="Paused Bench Press" assignment={ASSIGNMENT} />
  </Page>,
);

/** The read-only program review (Programs, My program) with the trainer's days tagged per row. */
const REVIEW_DAYS: [number, string, string][] = [
  [2, 'Tue', 'Upper A'],
  [4, 'Thu', 'Lower A'],
  [5, 'Fri', 'Upper B'],
  [6, 'Sat', 'Lower B'],
];
export const ProgramReviewTrainerDays: Story = world(
  'active',
  <Page>
    <GroupedList>
      {REVIEW_DAYS.map(([dow, abbr, name]) => (
        <ListRow
          key={dow}
          dense
          time={abbr}
          label={name}
          sub={
            <>
              4 exercises
              <ClientTrainerDayTag dow={dow} />
            </>
          }
        />
      ))}
    </GroupedList>
  </Page>,
);

/** ---- invite end state: the trainer's app finished the key exchange, so the page says "connected" ---- */
let connectedPort: ReturnType<typeof createFixturesClientPort> | null = null;
export const InviteConnected: Story = {
  render: () => {
    return (
      <ConnectedWorld>
        <Full>
          <InvitePages token="ok5" onExit={noop} />
        </Full>
      </ConnectedWorld>
    );
  },
  play: async () => {
    await click(t.invAccept)();
    await click(t.invSave)();
    await new Promise((r) => setTimeout(r, 200));
    connectedPort?.turnSharingOn();
  },
};
function ConnectedWorld({ children }: { children: ReactNode }) {
  useState(() => {
    connectedPort = createFixturesClientPort({ scenario: 'none' });
    configureClientCoach({
      port: connectedPort,
      chat: createFixturesClientChatPort({ unread: 0 }),
    });
  });
  useEffect(() => () => configureClientCoach(), []);
  return <>{children}</>;
}

/** ---- the client's Share picker in chat ---- */
export const ChatSharePicker: Story = chat({ picker: {} });
export const ChatSharePickerSearch: Story = chat({ picker: { q: 'bench' } });
export const ChatSharePending: Story = chat({
  pending: { kind: 'workout', id: 'w1-0', ownerId: 'c1' },
});
