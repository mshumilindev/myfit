import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { createFixturesPort } from '../data/__fixtures__/fixtures';
import { createDemoClock } from '../data/__fixtures__/demoClock';
import { configureCoachData } from '../data/config';
import { CoachShell } from '../CoachApp';
import type { CoachRoute } from '../routes';
import { createFixturesTeamPort, type FixturesTeamOptions } from './__fixtures__/fixtures';
import { configureTeam } from './useTeam';

/** The real shell around the activity log / roles route, with a chosen team port. */
function Frame({
  screen,
  options,
  manager,
}: {
  screen: 'activity' | 'roles' | 'spotter' | 'agenda';
  options?: FixturesTeamOptions;
  manager?: boolean;
}) {
  const [route, setRoute] = useState<CoachRoute>({ screen });
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

/** Activity log and role matrix (SPO-203). Boards D18 (owner), D19 (manager, own), D20 (manager, all), D21 (roles). */
const meta = {
  title: 'Pages/Coach/Team activity',
  component: Frame,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Frame>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Trainer: Story = { args: { screen: 'activity' } };
export const ManagerOwn: Story = { args: { screen: 'activity', manager: true } };
export const ManagerAll: Story = {
  args: { screen: 'activity', manager: true, options: { activityScope: 'all' } },
};
export const Failed: Story = {
  args: { screen: 'activity', options: { failWith: () => 'unavailable' } },
};
export const Roles: Story = { args: { screen: 'roles' } };
export const SpotterTrainer: Story = { args: { screen: 'spotter' } };
export const SpotterManager: Story = { args: { screen: 'spotter', manager: true } };
/** The Agenda tab shows the number of open team requests (SPO-204): the badge on the rail / tab bar, and the section itself. */
export const AgendaBadge: Story = { args: { screen: 'agenda', options: { withRequests: true } } };
export const AgendaBadgePhone: Story = {
  args: { screen: 'agenda', options: { withRequests: true } },
  parameters: { viewport: { value: 'phone' } },
  globals: { viewport: { value: 'phone', isRotated: false } },
};
