import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TabBar } from './TabBar';
import { LocaleMatrix } from '../../stories/LocaleMatrix';
import { coachStrings } from '../../i18n/coach';
import type { LocaleId } from '../../i18n';

const meta = {
  title: 'Kit/TabBar',
  component: TabBar,
  parameters: { layout: 'fullscreen' },
  args: {
    items: [
      { id: 'today', label: 'Today', icon: 'house', active: true },
      { id: 'overview', label: 'Overview', icon: 'chart-line-up' },
      { id: 'gyms', label: 'Gyms', icon: 'map-pin' },
      { id: 'apps', label: 'Apps', icon: 'squares-four' },
    ],
    onSelect: () => undefined,
    fab: { ariaLabel: 'Start', onClick: () => undefined },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          width: 390,
          height: 200,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TabBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

function Live() {
  const [tab, setTab] = useState('today');
  const items = [
    { id: 'today', label: 'Today', icon: 'house' },
    { id: 'overview', label: 'Overview', icon: 'chart-line-up' },
    { id: 'gyms', label: 'Gyms', icon: 'map-pin' },
  ].map((x) => ({ ...x, active: x.id === tab }));
  return (
    <TabBar
      items={items}
      onSelect={setTab}
      apps={{ label: 'Apps', ariaLabel: 'Apps', onClick: () => undefined }}
      fab={{ ariaLabel: 'Start', onClick: () => undefined }}
    />
  );
}

/** The app's real shape: three tabs + Apps + the Start FAB, interactive. */
export const App: Story = { render: () => <Live /> };

function CoachBar({ locale }: { locale: LocaleId }) {
  const c = coachStrings(locale);
  const [tab, setTab] = useState('today');
  const nav = [
    { id: 'today', icon: 'house', label: c.navAgenda },
    { id: 'clients', icon: 'users', label: c.navClients, n: 0 },
    { id: 'schedule', icon: 'calendar-blank', label: c.navSchedule },
    { id: 'chat', icon: 'chat-circle', label: c.navChat, n: 23 },
    { id: 'more', icon: 'dots-three', label: c.navMore, n: 4 },
  ];
  return (
    <TabBar
      breakpoint="coach"
      onSelect={setTab}
      items={nav.map((x) => ({
        id: x.id,
        icon: x.icon,
        label: x.label,
        active: x.id === tab,
        badge: x.n,
        ariaLabel: x.n ? c.navWithUnread(x.label, x.n) : undefined,
      }))}
    />
  );
}

/** Coach bar with item badges (R-KIT-21): 0 hidden, 4, and 23 → "9+"; five locales. */
export const CoachBadges: Story = {
  decorators: [(Story) => <Story />],
  render: () => <LocaleMatrix render={(_t, id) => <CoachBar locale={id} />} width={390} />,
};

function WithMore({ withFab }: { withFab?: boolean }) {
  const [tab, setTab] = useState('today');
  const [open, setOpen] = useState(false);
  const items = [
    { id: 'today', label: 'Today', icon: 'house' },
    { id: 'overview', label: 'Overview', icon: 'chart-line-up' },
    { id: 'gyms', label: 'Gyms', icon: 'map-pin' },
  ].map((x) => ({ ...x, active: x.id === tab }));
  return (
    <TabBar
      items={items}
      onSelect={setTab}
      more={{ label: 'More', open, onClick: () => setOpen((o) => !o) }}
      fab={withFab ? { ariaLabel: 'Start', onClick: () => undefined } : undefined}
    />
  );
}

/** The trailing More tab (replaces Apps in every app of the suite); lit while its sheet is open. */
export const More: Story = { render: () => <WithMore /> };

/** The same with the Start FAB (Gym): two tabs left of the notch, the rest and More right of it. */
export const MoreWithFab: Story = { render: () => <WithMore withFab /> };
