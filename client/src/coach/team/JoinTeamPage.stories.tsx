import type { Meta, StoryObj } from '@storybook/react-vite';
import { createDemoClock } from '../data/__fixtures__/demoClock';
import { createFixturesTeamPort, type FixturesTeamOptions } from './__fixtures__/fixtures';
import { JoinTeamPage } from './JoinTeamPage';

function Frame({ options }: { options?: FixturesTeamOptions }) {
  return (
    <JoinTeamPage
      token="inv-demo"
      port={createFixturesTeamPort({ now: createDemoClock(), ...options })}
      onExit={() => undefined}
    />
  );
}

/** Join the team (SPO-196, board D16): the page behind `#/team-invite/<token>`. */
const meta = {
  title: 'Pages/Coach/JoinTeam',
  component: Frame,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Frame>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AsManager: Story = { args: {} };
export const AsTrainer: Story = { args: { options: { invite: { role: 'trainer' } } } };
export const Closed: Story = { args: { options: { invite: { closed: true } } } };
export const NotEligible: Story = { args: { options: { invite: { notEligible: true } } } };
export const Offline: Story = { args: { options: { failWith: () => 'offline' } } };
export const Loading: Story = { args: { options: { delayMs: 60_000 } } };
