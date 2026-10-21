import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { createFixturesPort } from '../data/__fixtures__/fixtures';
import { createDemoClock } from '../data/__fixtures__/demoClock';
import { configureCoachData } from '../data/config';
import { CoachShell } from '../CoachApp';
import type { CoachRoute } from '../routes';
import { createFixturesTeamPort, type FixturesTeamOptions } from './__fixtures__/fixtures';
import { clickThrough } from './__fixtures__/play';
import { configureTeam } from './useTeam';
import { teamEn as tm } from '../../i18n/coachTeam.en';

/** The real shell (rail / tab bar by width) around the Team route, with a chosen team port; one store per mount. */
function TeamStoryFrame({
  options,
  manager,
}: {
  options?: FixturesTeamOptions;
  manager?: boolean;
}) {
  const [route, setRoute] = useState<CoachRoute>({ screen: 'team' });
  useMemo(() => {
    configureCoachData({ world: createFixturesPort({ delayMs: 0 }), uid: 'trainer-iryna' });
    configureTeam(
      createFixturesTeamPort({
        now: createDemoClock(),
        viewer: manager ? 'manager' : 'trainer',
        ...options,
      }),
    );
  }, [options, manager]);
  return (
    <CoachShell
      role={manager ? 'manager' : 'trainer'}
      name={manager ? 'Irina Melnyk' : 'Olena Kovalenko'}
      route={route}
      onNavigate={setRoute}
      onExitToWorkouts={() => undefined}
      onOpenProfile={() => undefined}
      onOpenShell={() => undefined}
    />
  );
}

/** Team (SPO-196): members, pending invites, activity log / roles entry points, Leave. Boards D12 / D13. */
const meta = {
  title: 'Pages/Coach/Team',
  component: TeamStoryFrame,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TeamStoryFrame>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Trainer: Story = { args: {} };
export const Manager: Story = { args: { manager: true } };
export const Loading: Story = { args: { options: { cold: true, delayMs: 60_000 } } };
export const LoadFailed: Story = {
  args: { options: { cold: true, failWith: () => 'unavailable' } },
};

const PHONE = {
  parameters: { viewport: { value: 'phone' } },
  globals: { viewport: { value: 'phone', isRotated: false } },
} as const;

/** Add a team member (SPO-200, boards D14 / D14b / T3 / P8): the trainer starts on Manager, the manager on Trainer. */
export const AddMemberTrainer: Story = { args: {}, play: clickThrough(tm.tmAddMember) };
export const AddMemberManager: Story = {
  args: { manager: true },
  play: clickThrough(tm.tmAddMember),
};
export const AddMemberPhone: Story = { ...AddMemberTrainer, ...PHONE };

/** A manager's card (boards D17 / D17b / T4 / T4b): "See all team activity" off, then on. */
const openIrina = clickThrough(tm.tmOpenMember('Irina Melnyk'));
export const MemberSheetOff: Story = { args: {}, play: openIrina };
export const MemberSheetOn: Story = { args: { options: { managerScope: 'all' } }, play: openIrina };
export const MemberSheetPhone: Story = { ...MemberSheetOff, ...PHONE };

/** The confirmations with their effects (boards D21 / D22 / D23 / T6 / T7 / P10). */
export const RemoveManagerDialog: Story = {
  args: {},
  play: clickThrough(tm.tmOpenMember('Irina Melnyk'), tm.tmRemoveFromTeam),
};
export const RemoveManagerDialogPhone: Story = { ...RemoveManagerDialog, ...PHONE };
export const LeaveTeamTrainerDialog: Story = {
  args: { options: { notOwner: true } },
  play: clickThrough(tm.tmLeave),
};
export const LeaveTeamManagerDialog: Story = {
  args: { manager: true },
  play: clickThrough(tm.tmLeave),
};
export const LeaveTeamManagerDialogPhone: Story = { ...LeaveTeamManagerDialog, ...PHONE };
