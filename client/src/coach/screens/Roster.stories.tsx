import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import { createFixturesPort } from '../data/__fixtures__/fixtures';
import { CoachStoryFrame } from './storyKit';
import { emptyRoster, lockedClient, withInvites, worldPort } from './storyPorts';

/**
 * Clients (S-17 / S-18) inside the real shell. Pick the viewport in the toolbar: 1440 / 1024 = list + detail,
 * 390 = list only with the tab bar. Worlds are the lab fixtures (Wed 7 Oct 2026, Iryna Melnyk, 14 clients).
 */
const meta = {
  title: 'Pages/Coach/Roster',
  component: CoachStoryFrame,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CoachStoryFrame>;
export default meta;
type Story = StoryObj<typeof meta>;

const ready = () => worldPort(undefined, { warm: true });
const route = { screen: 'clients' } as const;

export const Roster: Story = { args: { route, makePort: ready } };
export const WithPendingInvites: Story = {
  args: { route, makePort: () => worldPort(withInvites, { warm: true }) },
};
export const Empty: Story = {
  args: { route, makePort: () => worldPort(emptyRoster, { warm: true }) },
};
const slow = () => createFixturesPort({ delayMs: 60_000 });
export const Loading: Story = { args: { route, makePort: slow } };
const failing = () => createFixturesPort({ failWith: () => 'unavailable' });
export const LoadFailed: Story = { args: { route, makePort: failing } };
const offline = () => worldPort(undefined, { warm: true, failWith: () => 'offline' });
export const Offline: Story = { args: { route, makePort: offline } };
const stale = () => worldPort(undefined, { warm: true, delayMs: 60_000 });
export const Stale: Story = { args: { route, makePort: stale } };
export const OneLockedClient: Story = {
  args: { route, makePort: () => worldPort(lockedClient, { warm: true }) },
};

/** roster-invite / -hybrid / -program: the invite panel opened in each logging mode (play steps click through it). */
const invite = (mode: 'App' | 'Hybrid' | 'Program only') => ({
  args: { route, makePort: ready },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const c = within(canvasElement);
    await userEvent.click(await c.findByRole('button', { name: 'Invite client' }));
    if (mode !== 'App') await userEvent.click(await c.findByRole('button', { name: mode }));
    await userEvent.type(await c.findByRole('textbox', { name: 'Name' }), 'Olena Marchenko');
  },
});
export const InviteApp: Story = invite('App');
export const InviteHybrid: Story = invite('Hybrid');
export const InviteProgram: Story = invite('Program only');
