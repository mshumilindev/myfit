import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppRail, type RailNavItem } from '../AppRail';
import { SuiteTabBar } from '../SuiteTabBar';
import type { SuiteApp } from './useSuiteAccount';

/**
 * The navigation every app of the suite shares with Coach: kit Rail (88px labelled from 1280,
 * 60px icon-only below, fixed tiles, More only when the destinations do not fit, Apps pinned
 * above the avatar, avatar = account popover only) and the phone tab bar whose trailing More tab
 * opens destinations, Apps last, then the account. Pick the viewport in the toolbar (Web 1280 =
 * labelled, Tablet 1024 = icon rail, Phone 390 = tab bar). Each app brings its own accent through
 * the wrapper class (accent ramp), nothing else differs.
 */
const NAV: Record<string, RailNavItem[]> = {
  gym: [
    { id: 'today', icon: 'house', label: 'Today' },
    { id: 'overview', icon: 'chart-line-up', label: 'Overview' },
    { id: 'gyms', icon: 'map-pin', label: 'Gyms' },
  ],
  apex: [
    { id: 'home', icon: 'house', label: 'Home' },
    { id: 'challenges', icon: 'flag-banner', label: 'Challenges' },
    { id: 'ranks', icon: 'trophy', label: 'Ranks' },
    { id: 'awards', icon: 'medal', label: 'Awards' },
  ],
  people: [
    { id: 'clients', icon: 'user-focus', label: 'Clients' },
    { id: 'me', icon: 'user', label: 'Me' },
  ],
  nutrition: [
    { id: 'today', icon: 'house', label: 'Today' },
    { id: 'history', icon: 'clock-counter-clockwise', label: 'History' },
    { id: 'goal', icon: 'crosshair', label: 'Goal' },
  ],
  learn: [
    { id: 'home', icon: 'play-circle', label: 'Home' },
    { id: 'topics', icon: 'stack', label: 'Topics' },
    { id: 'saved', icon: 'bookmark-simple', label: 'Saved' },
  ],
};
const APP: Record<string, SuiteApp> = {
  gym: 'gym',
  apex: 'apex',
  people: 'roster',
  nutrition: 'nutrition',
  learn: 'learn',
};
const SKIN: Record<string, string> = {
  gym: '',
  apex: 'app-apex apex-app',
  people: 'app-roster apex-app',
  nutrition: 'app-nutrition apex-app',
  learn: 'app-learn apex-app',
};

function Frame({ app, height = '100vh' }: { app: keyof typeof NAV; height?: number | string }) {
  const [id, setId] = useState(NAV[app][0].id);
  return (
    <div className={SKIN[app]} style={{ display: 'flex', height }}>
      <AppRail
        app={APP[app]}
        nav={NAV[app]}
        activeId={id}
        onNav={setId}
        onOpenShell={() => window.alert('Suite launcher opens here')}
        onOpenNotifications={() => undefined}
        onOpenProfile={() => undefined}
        notifUnread={app === 'apex' ? 3 : 0}
      />
    </div>
  );
}

function Phone({ app }: { app: keyof typeof NAV }) {
  const [id, setId] = useState(NAV[app][0].id);
  return (
    <div
      className={SKIN[app]}
      style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 360 }}
    >
      <SuiteTabBar
        app={APP[app]}
        tabs
        activeFill
        items={NAV[app].map((x) => ({ ...x, active: x.id === id }))}
        onSelect={setId}
        onOpenShell={() => window.alert('Suite launcher opens here')}
        onOpenProfile={() => undefined}
      />
    </div>
  );
}

const meta = {
  title: 'Pages/Suite/Navigation',
  parameters: { layout: 'fullscreen', viewport: { value: 'web' } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Gym (brass): three destinations, never a More at this height. */
export const GymRail: Story = { render: () => <Frame app="gym" /> };
/** Apex (amethyst). */
export const ApexRail: Story = { render: () => <Frame app="apex" /> };
/** People (silver). */
export const PeopleRail: Story = { render: () => <Frame app="people" /> };
/** Nutrition (lazurite). */
export const NutritionRail: Story = { render: () => <Frame app="nutrition" /> };
/** Learn (rubellite). */
export const LearnRail: Story = { render: () => <Frame app="learn" /> };

/** Resize the preview height below ~270px: trailing destinations collapse into More. */
export const ShortWindow: Story = {
  render: () => <Frame app="apex" height={260} />,
};

/** Phone: the app's own tabs, then More (Apps lives inside it now). Tap More for the sheet. */
export const PhoneApex: Story = {
  parameters: { viewport: { value: 'phone' } },
  globals: { viewport: { value: 'phone', isRotated: false } },
  render: () => <Phone app="apex" />,
};
export const PhoneNutrition: Story = {
  parameters: { viewport: { value: 'phone' } },
  globals: { viewport: { value: 'phone', isRotated: false } },
  render: () => <Phone app="nutrition" />,
};
