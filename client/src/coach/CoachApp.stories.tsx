import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CoachShell } from './CoachApp';
import type { CoachRoute } from './routes';

/**
 * The Coach shell. Rail / tab bar follow the window width (JS `matchMedia`), so
 * pick the viewport in the toolbar: Web 1280 = labelled rail (88), Tablet 1024 =
 * icon rail (60), Phone 390 = tab bar with More.
 */
const meta = {
  title: 'Pages/Coach/Shell',
  component: CoachShell,
  parameters: { layout: 'fullscreen', viewport: { value: 'web' } },
  args: {
    role: 'trainer',
    name: 'Iryna Koval',
    route: { screen: 'agenda' },
    onNavigate: () => undefined,
    onExitToWorkouts: () => undefined,
    onOpenProfile: () => undefined,
    onOpenShell: () => undefined,
  },
  render: function Render(args) {
    const [route, setRoute] = useState<CoachRoute>(args.route);
    return <CoachShell {...args} route={route} onNavigate={setRoute} />;
  },
} satisfies Meta<typeof CoachShell>;
export default meta;
type Story = StoryObj<typeof meta>;

/** >= 1280: labelled 88px rail, frame 1128 wide at 1280. */
export const Desktop: Story = {};

/** 768..1279: 60px icon rail, tooltips on hover and focus. */
export const Tablet: Story = {
  parameters: {
    viewport: {
      value: 'tablet',
      options: {
        tablet: {
          name: 'Tablet 1024×768',
          styles: { width: '1024px', height: '768px' },
          type: 'tablet',
        },
      },
    },
  },
  globals: { viewport: { value: 'tablet', isRotated: false } },
};

/** < 768: bottom tab bar (Today, Clients, Schedule, Chat, More). */
export const Phone: Story = {
  parameters: { viewport: { value: 'phone' } },
  globals: { viewport: { value: 'phone', isRotated: false } },
};

/** An admin gets the same shell (admin = coach). */
export const AdminRole: Story = { args: { role: 'admin', name: 'Root Admin' } };

/** A client page placeholder with a real Back button. */
export const ClientPage: Story = { args: { route: { screen: 'client', cid: 'demo' } } };

/**
 * More: last-but-one in the rail foot (above the avatar), the tab bar's More tab on phone. Its
 * first row, Apps, opens the suite launcher (the callback here) with Coach as the current tile.
 */
export const WithMoreMenu: Story = {
  args: {
    onOpenShell: () => {
      window.alert('Suite launcher opens here');
    },
  },
};
