import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { createFixturesPort } from '../data/__fixtures__/fixtures';
import { configureCoachData } from '../data/config';
import { CoachShell } from '../CoachApp';
import type { CoachRoute } from '../routes';
import { MANAGER_CLIENTS } from './__fixtures__/managerClients';
import { clickThrough } from './__fixtures__/play';
import { configureManagerClients, createStaticManagerClients } from './managerClients';
import { teamEn as tm } from '../../i18n/coachTeam.en';

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

/** The "Invite client" sheet over the manager's Clients (SPO-202). */
const openInvite = async () => {
  for (let i = 0; i < 60; i++) {
    const b = [...document.querySelectorAll('button')].find((x) =>
      x.textContent?.includes('Invite client'),
    );
    if (b) return (b as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 50));
  }
};
export const InviteClientDesktop: Story = { play: openInvite };
export const InviteClientPhone: Story = {
  play: openInvite,
  parameters: { viewport: { value: 'phone' } },
  globals: { viewport: { value: 'phone', isRotated: false } },
};

/** The client's cut-down card (SPO-202, boards D10 / P6): contacts and sessions, no health, no messages. */
export const ClientCard: Story = { play: clickThrough('Oleh Bondar') };
/** "Ask Olena to remove Oleh?" (boards D25 / P11). */
export const RequestRemovalDialog: Story = {
  play: clickThrough('Oleh Bondar', tm.mcRequestRemoval),
};
export const RequestRemovalDialogPhone: Story = {
  ...RequestRemovalDialog,
  parameters: { viewport: { value: 'phone' } },
  globals: { viewport: { value: 'phone', isRotated: false } },
};
