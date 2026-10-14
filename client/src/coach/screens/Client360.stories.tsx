import type { Meta, StoryObj } from '@storybook/react-vite';
import { createFixturesPort, buildFixtureWorld } from '../data/__fixtures__/fixtures';
import { CoachStoryFrame } from './storyKit';
import { idOf, lockedClient, totalsOnlyClient, worldPort } from './storyPorts';

/** Client 360 shell (S-03): header, tabs, Overview; locked / program-only / revoked / not-found states. */
const meta = {
  title: 'Pages/Coach/Client 360',
  component: CoachStoryFrame,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CoachStoryFrame>;
export default meta;
type Story = StoryObj<typeof meta>;

const W = buildFixtureWorld();
const ready = () => worldPort(undefined, { warm: true });
const at = (name: string, tab?: string) => ({ screen: 'client', cid: idOf(W, name), tab }) as const;

export const Overview: Story = { args: { route: at('Oleh Bondar'), makePort: ready } };
/** client360-locked: Viktoriia shares workout totals only (sets, sleep, injuries, nutrition are closed). */
export const Locked: Story = {
  args: {
    route: at('Viktoriia Danylchuk'),
    makePort: () => worldPort(totalsOnlyClient, { warm: true }),
  },
};
/** Shares nothing at all: the notice explains what the coach still sees. */
export const SharesNothing: Story = {
  args: {
    route: at('Viktoriia Danylchuk'),
    makePort: () => worldPort(lockedClient, { warm: true }),
  },
};
/** client360-offline (program only) */
export const ProgramOnly: Story = { args: { route: at('Maksym Shevchuk'), makePort: ready } };
/** client360-workouts: today, reschedule request, next sessions, 41 sessions by week, Export. */
export const WorkoutsTab: Story = {
  args: { route: at('Oleh Bondar', 'workouts'), makePort: ready },
};
/** workouts-totals-only: durations only; sets, tonnage, PR and adherence are left out and named. */
export const WorkoutsTotalsOnly: Story = {
  args: {
    route: at('Oleh Bondar', 'workouts'),
    makePort: () =>
      worldPort(
        (w) => ({
          ...w,
          clients: w.clients.map((c) =>
            c.name === 'Oleh Bondar'
              ? { ...c, consent: { ...c.consent, sets: 'off' as const, totals: 'full' as const } }
              : c,
          ),
        }),
        { warm: true },
      ),
  },
};
/** No grant at all: the history is a locked row with "Ask to share". */
export const WorkoutsLocked: Story = {
  args: {
    route: at('Viktoriia Danylchuk', 'workouts'),
    makePort: () => worldPort(lockedClient, { warm: true }),
  },
};
export const WorkoutsProgramOnly: Story = {
  args: { route: at('Maksym Shevchuk', 'workouts'), makePort: ready },
};
/** strength: 13 exercises, search, sort, the stalled bench press. */
export const StrengthTab: Story = {
  args: { route: at('Oleh Bondar', 'strength'), makePort: ready },
};
/** strength-locked: the client does not share sets. */
export const StrengthLocked: Story = {
  args: {
    route: at('Viktoriia Danylchuk', 'strength'),
    makePort: () => worldPort(totalsOnlyClient, { warm: true }),
  },
};
export const DecisionsTab: Story = {
  args: { route: at('Oleh Bondar', 'decisions'), makePort: ready },
};
export const NotOnList: Story = {
  args: { route: { screen: 'client', cid: 'nobody' }, makePort: ready },
};
/** err-access-revoked: a forbidden read */
export const AccessRevoked: Story = {
  args: {
    route: at('Oleh Bondar'),
    makePort: () => worldPort(undefined, { warm: true, failWith: () => 'forbidden' }),
  },
};
export const Loading: Story = {
  args: { route: at('Oleh Bondar'), makePort: () => createFixturesPort({ delayMs: 60_000 }) },
};
export const LoadFailed: Story = {
  args: {
    route: at('Oleh Bondar'),
    makePort: () => createFixturesPort({ failWith: () => 'unavailable' }),
  },
};
