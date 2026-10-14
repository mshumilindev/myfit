import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Rail, RailItem } from './Rail';
import { Avatar } from './Avatar';
import { LocaleMatrix } from '../../stories/LocaleMatrix';
import { coachStrings } from '../../i18n/coach';
import type { LocaleId } from '../../i18n';

const meta = {
  title: 'Kit/Rail',
  component: Rail,
  parameters: { layout: 'fullscreen', viewport: { value: 'web' } },
  args: { brand: <Avatar name="S" size={40} />, children: null },
  decorators: [
    (Story) => (
      <div style={{ height: 720, display: 'flex' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Rail>;
export default meta;
type Story = StoryObj<typeof meta>;

function Live() {
  const [tab, setTab] = useState('today');
  const items = [
    { id: 'today', icon: 'house', label: 'Today' },
    { id: 'overview', icon: 'chart-line-up', label: 'Overview' },
    { id: 'gyms', icon: 'map-pin', label: 'Gyms' },
  ];
  return (
    <Rail
      brand={<Avatar name="Spotter" size={40} />}
      foot={
        <>
          <RailItem icon="bell" ariaLabel="Alerts" badge="3" />
          <RailItem icon="squares-four" ariaLabel="Apps" className="rail-switch" />
          <RailItem icon="gear" label="Settings" />
        </>
      }
    >
      {items.map((x) => (
        <RailItem
          key={x.id}
          icon={x.icon}
          label={x.label}
          active={tab === x.id}
          fillWhenActive
          live={x.id === 'today'}
          onClick={() => setTab(x.id)}
        />
      ))}
    </Rail>
  );
}

/** The Gym rail: three tabs, a live dot on Today, a foot with badge + settings. */
export const Gym: Story = { render: () => <Live /> };

const COACH_NAV = [
  { id: 'today', icon: 'house', key: 'navAgenda' },
  { id: 'clients', icon: 'users', key: 'navClients' },
  { id: 'schedule', icon: 'calendar-blank', key: 'navSchedule' },
  { id: 'decisions', icon: 'lightning', key: 'navDecisions' },
  { id: 'chat', icon: 'chat-circle', key: 'navChat' },
] as const;

function CoachRail({
  mode,
  locale = 'en',
  unread = 3,
}: {
  mode: 'labelled' | 'compact';
  locale?: LocaleId;
  unread?: number;
}) {
  const c = coachStrings(locale);
  const [tab, setTab] = useState('today');
  return (
    <Rail
      brand={<Avatar name="Spotter" size={40} />}
      labelled={mode === 'labelled'}
      compact={mode === 'compact'}
      ariaLabel={c.navLandmark}
      foot={
        <>
          <RailItem
            icon="bell"
            fill
            ariaLabel={c.railNotifications}
            tooltip={c.railNotifications}
            count={unread}
            countLabel={c.unread(unread)}
          />
          <RailItem icon="user-circle" ariaLabel={c.railProfile} tooltip={c.railProfile} />
        </>
      }
    >
      {COACH_NAV.map((x) => (
        <RailItem
          key={x.id}
          icon={x.icon}
          label={c[x.key]}
          active={tab === x.id}
          fillWhenActive
          count={x.id === 'chat' ? unread : undefined}
          countLabel={c.unread(unread)}
          live={x.id === 'today'}
          liveLabel={c.railLive(2)}
          onClick={() => setTab(x.id)}
        />
      ))}
    </Rail>
  );
}

/** Coach wide rail (R-KIT-20): 88px, 13px label under every icon, badge + live dot. */
export const Labelled: Story = {
  render: () => <CoachRail mode="labelled" unread={148} />,
};

/** Coach narrow rail: 60px, icons only. Hover or Tab to an item for the tooltip; Esc dismisses it. */
export const Compact: Story = {
  render: () => <CoachRail mode="compact" />,
};

/** Rail labels in all five locales (labelled rail, long words truncate with an ellipsis). */
export const LabelledLocales: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <LocaleMatrix
      width={200}
      render={(_t, id) => (
        <div style={{ height: 420, display: 'flex' }}>
          <CoachRail mode="labelled" locale={id} />
        </div>
      )}
    />
  ),
};
