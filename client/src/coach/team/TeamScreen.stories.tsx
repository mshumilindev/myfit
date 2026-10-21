import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { createFixturesPort } from '../data/__fixtures__/fixtures';
import { createDemoClock } from '../data/__fixtures__/demoClock';
import { configureCoachData } from '../data/config';
import { CoachShell } from '../CoachApp';
import type { CoachRoute } from '../routes';
import { createFixturesTeamPort, type FixturesTeamOptions } from './__fixtures__/fixtures';
import { configureTeam } from './useTeam';

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
