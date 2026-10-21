import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MoreMenu, MoreMenuBody, type MoreMenuItem } from './MoreMenu';
import { Avatar } from './Avatar';
import { Rail, RailItem } from './Rail';
import { LocaleMatrix } from '../../stories/LocaleMatrix';
import { coachStrings } from '../../i18n/coach';

/**
 * More: Apps + the app's secondary destinations + the account block (avatar, role, mode
 * switch, privacy note, Profile). Desktop = Popover next to the rail's More item, phone =
 * bottom Sheet from the tab bar's More tab. App-agnostic: every app passes its own items.
 */
const meta = {
  title: 'Coach/MoreMenu',
  component: MoreMenu,
  parameters: { layout: 'fullscreen' },
  args: {
    presentation: 'popover',
    open: true,
    onClose: () => undefined,
    title: 'More',
  },
} satisfies Meta<typeof MoreMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

const c = coachStrings('en');
const items: MoreMenuItem[] = [
  { id: 'signals', label: c.navSignals, icon: 'pulse', onSelect: () => undefined },
  { id: 'live', label: c.navLive, icon: 'heartbeat', onSelect: () => undefined, count: 2 },
];
const account = {
  name: 'Iryna Koval',
  roleLabel: c.roleTrainer,
  modes: [
    { value: 'coach', label: c.modeCoach },
    { value: 'workouts', label: c.modeMyWorkouts },
  ],
  mode: 'coach',
  modeLabel: c.modeLabel,
  onModeChange: () => undefined,
  note: c.modeNote,
  profile: { label: c.moreProfile, onOpen: () => undefined },
  signOut: { label: 'Sign out', onSelect: () => undefined },
};

function RailDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(true);
  return (
    <div style={{ height: 640, display: 'flex' }}>
      <Rail
        brand={<span />}
        compact
        foot={
          <div ref={ref}>
            <RailItem
              icon="dots-three"
              label={c.navMore}
              tooltip={c.navMore}
              active={open}
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            />
          </div>
        }
      >
        <RailItem icon="sun-horizon" label={c.navAgenda} active />
      </Rail>
      <MoreMenu
        presentation="popover"
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={ref}
        title={c.navMore}
        items={items}
        apps={{ label: c.navApps, onOpen: () => undefined }}
        account={{ ...account, avatar: <Avatar name="Iryna Koval" size={40} /> }}
      />
    </div>
  );
}

/** Desktop: popover anchored to a rail item, Apps + two destinations + account block. */
export const Popover: Story = { render: () => <RailDemo /> };

/** Phone: the same content in the bottom sheet (every destination, current one marked). */
export const Sheet: Story = {
  parameters: { viewport: { value: 'phone' } },
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: {
    presentation: 'sheet',
    items: [
      { id: 'week', label: c.navWeek, icon: 'calendar-dots', onSelect: () => undefined },
      {
        id: 'decisions',
        label: c.navDecisions,
        icon: 'check-circle',
        onSelect: () => undefined,
        active: true,
      },
      ...items,
    ],
    apps: { label: c.navApps, onOpen: () => undefined },
    account,
  },
};

/** The phone sheet wears the current app's colour, like the launcher; one story per family. */
const toned = (tone: 'gym' | 'apex' | 'people' | 'kcal' | 'learn' | 'coach'): Story => ({
  parameters: { viewport: { value: 'phone' } },
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: { ...Sheet.args, tone },
});
export const SheetGym: Story = toned('gym');
export const SheetApex: Story = toned('apex');
export const SheetPeople: Story = toned('people');
export const SheetNutrition: Story = toned('kcal');
export const SheetLearn: Story = toned('learn');
export const SheetCoach: Story = toned('coach');

/** An app with no account modes (e.g. a member in People): Apps + account, no switch. */
export const NoModes: Story = {
  parameters: { viewport: { value: 'phone' } },
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: {
    presentation: 'sheet',
    apps: { label: c.navApps, onOpen: () => undefined },
    account: { name: 'Marek', roleLabel: 'Member', profile: account.profile },
  },
};

/** Rail overflow popover: destinations only. The last row keeps the same s-8 inset as top/sides. */
export const ListOnly: Story = {
  args: { items, anchorRef: { current: null } },
};

/** The content alone, in five locales. */
export const Locales: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <LocaleMatrix
      width={360}
      render={(_t, id) => {
        const s = coachStrings(id);
        return (
          <div style={{ width: 340, background: 'var(--color-surface)', borderRadius: 16 }}>
            <MoreMenuBody
              items={[
                { id: 'signals', label: s.navSignals, icon: 'pulse', onSelect: () => undefined },
              ]}
              apps={{ label: s.navApps, onOpen: () => undefined }}
              account={{
                ...account,
                roleLabel: s.roleTrainer,
                modes: [
                  { value: 'coach', label: s.modeCoach },
                  { value: 'workouts', label: s.modeMyWorkouts },
                ],
                modeLabel: s.modeLabel,
                note: s.modeNote,
                profile: { label: s.moreProfile, onOpen: () => undefined },
              }}
            />
          </div>
        );
      }}
    />
  ),
};

/** A row that opens a choose-one list inside the menu (Language): click, Enter or → opens it, Esc / ← / Back return. */
export const LanguageSubmenu: Story = {
  render: () => <LanguageSubmenuDemo />,
};

function LanguageSubmenuDemo() {
  const [value, setValue] = useState('en');
  return (
    <MoreMenu
      presentation="popover"
      open
      onClose={() => undefined}
      anchorRef={{ current: null }}
      title="More"
      items={[
        ...items,
        {
          id: 'language',
          label: 'Language',
          icon: 'globe',
          onSelect: () => undefined,
          submenu: {
            title: 'Language',
            value,
            options: [
              { id: 'en', label: 'English', icon: <span aria-hidden>🇬🇧</span> },
              { id: 'uk', label: 'Українська', icon: <span aria-hidden>🇺🇦</span> },
              { id: 'pl', label: 'Polski', icon: <span aria-hidden>🇵🇱</span> },
            ],
            onChange: setValue,
          },
        },
      ]}
    />
  );
}
