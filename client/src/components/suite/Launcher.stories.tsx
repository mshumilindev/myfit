import type { Meta, StoryObj } from '@storybook/react-vite';
import { ShellLauncher } from '../ShellLauncher';
import type { StoreState } from '../../store';

/**
 * The suite launcher is colour-coded to the app you are in: an accent-tinted dark plate (6-8% of
 * the app's colour) with a 1px accent-line edge; the tiles keep their own surfaces and rims, the
 * current one is outlined, tinted and checked. Phone = bottom sheet, desktop (>= 720) = right drawer.
 * The page behind takes the app's accent from the `theme-*` class on the root, so toggle it in
 * the toolbar's viewport only; the plate itself follows `current`.
 */
const noop = () => undefined;
const meta = {
  title: 'Pages/Suite/Launcher',
  component: ShellLauncher,
  parameters: { layout: 'fullscreen' },
  args: {
    store: { workouts: [], queue: [] } as unknown as StoreState,
    now: 0,
    current: 'gym',
    peopleLabel: 'People',
    peopleDesc: 'Your clients & profile.',
    activeChallenges: 2,
    notifUnread: 3,
    onGym: noop,
    onApex: noop,
    onRoster: noop,
    onNutrition: noop,
    nutritionEnabled: true,
    onLearn: noop,
    onClose: noop,
  },
} satisfies Meta<typeof ShellLauncher>;
export default meta;
type Story = StoryObj<typeof meta>;

export const InGym: Story = {};
export const InApex: Story = { args: { current: 'apex' } };
export const InPeople: Story = { args: { current: 'roster' } };
export const InNutrition: Story = { args: { current: 'nutrition' } };
export const InLearn: Story = { args: { current: 'learn' } };
export const InCoach: Story = { args: { current: 'coach' } };
