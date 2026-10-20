import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { createFixturesPort } from '../data/__fixtures__/fixtures';
import { configureCoachData } from '../data/config';
import { CoachShell } from '../CoachApp';
import type { CoachRoute } from '../routes';
import { MANAGER_CLIENTS } from './__fixtures__/managerClients';
import { configureManagerClients, createStaticManagerClients } from './managerClients';

function Frame() {
  const [route, setRoute] = useState<CoachRoute>({ screen: 'clients' });
  useMemo(() => {
    configureCoachData({ world: createFixturesPort({ delayMs: 0 }), uid: 'manager-max' });
    configureManagerClients(createStaticManagerClients(MANAGER_CLIENTS));
  }, []);
  return (
    <CoachShell
      role="manager"
      name="Irina Melnyk"
      route={route}
      onNavigate={setRoute}
      onExitToWorkouts={() => undefined}
      onOpenProfile={() => undefined}
      onOpenShell={() => undefined}
    />
  );
}

/** Manager Clients (SPO-202): the team's clients, who is ready, the next session. Boards D29 / P15. */
const meta = {
  title: 'Pages/Coach/Manager clients',
  component: Frame,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Frame>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {};
export const Phone: Story = {
  parameters: { viewport: { value: 'phone' } },
  globals: { viewport: { value: 'phone', isRotated: false } },
};
