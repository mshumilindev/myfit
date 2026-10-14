import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Rail, RailItem } from './Rail';
import { MoreMenu } from './MoreMenu';
import { Avatar } from './Avatar';
import type { RailEntry, RailFootEntry } from './railOverflow';
import { coachStrings } from '../../i18n/coach';

/**
 * Rail `overflow` (kit, app-agnostic): the rail measures the height of its nav column
 * (ResizeObserver, no breakpoints). Only when entries do not all fit do the trailing ones
 * collapse into a "More" item; when everything fits there is NO More item. Order = from the end
 * of the list (or by `priority`, higher collapses first); in More the order is kept.
 * Tiles are FIXED (labelled 72x64, compact 44; 5.6px gap, pitch 69.6 / 49.6) and top aligned: they never shrink or spread, only the
 * count changes. The More item sits in the nav column right below the last visible entry; the foot (extras, Apps,
 * the avatar) is pinned at the bottom and Apps is never part of the collapse. Seven entries need a 482px nav column on the 88px rail (about 650px of rail height), 342px on the 60px rail.
 */
const c = coachStrings('en');
const ENTRIES: RailEntry[] = [
  ['agenda', c.navAgenda, 'calendar-check'],
  ['clients', c.navClients, 'user-focus'],
  ['schedule', c.navSchedule, 'calendar-blank'],
  ['week', c.navWeek, 'calendar-dots'],
  ['decisions', c.navDecisions, 'check-circle'],
  ['programs', c.navPrograms, 'list-checks'],
  ['chat', c.navChat, 'envelope'],
].map(([id, label, icon], i) => ({
  id,
  label,
  icon,
  active: i === 0,
  onSelect: () => undefined,
}));

function Stage({ height, mode }: { height: number; mode: 'labelled' | 'compact' }) {
  const [h, setH] = useState(height);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ font: '600 12px var(--font)', color: 'var(--color-text-muted)' }}>
        Rail height {h}px{' '}
        <input
          type="range"
          min={240}
          max={900}
          value={h}
          onChange={(e) => setH(Number(e.target.value))}
        />
      </label>
      <div style={{ height: h, display: 'flex', background: 'var(--color-bg)' }}>
        <Rail
          brand={<Avatar name="Spotter" size={40} />}
          labelled={mode === 'labelled'}
          compact={mode === 'compact'}
          overflow={{
            entries: ENTRIES,
            moreLabel: c.navMore,
            renderMenu: function Menu({ hidden, open, onClose, anchorRef }) {
              return (
                <MoreMenu
                  presentation="popover"
                  open={open}
                  onClose={onClose}
                  anchorRef={anchorRef}
                  title={c.navMore}
                  items={hidden}
                />
              );
            },
          }}
          foot={
            <>
              <RailItem icon="squares-four" label={c.navApps} tooltip={c.navApps} />
              <Avatar name="Iryna Koval" size={34} />
            </>
          }
        />
      </div>
    </div>
  );
}

const meta = {
  title: 'Coach/Rail overflow',
  component: Stage,
  parameters: { layout: 'fullscreen', viewport: { value: 'web' } },
  args: { height: 720, mode: 'labelled' },
} satisfies Meta<typeof Stage>;
export default meta;
type Story = StoryObj<typeof meta>;

/** 900px: everything fits, no More item, Apps is the last rail entry. */
export const Tall900: Story = { args: { height: 900 } };
/** 720px: plenty of room, no More. */
export const Medium720: Story = { args: { height: 720 } };
/** 600px: same tiles, More already holds the trailing ones (about 650px needed for all seven). */
export const Short600: Story = { args: { height: 600 } };
/** 480px: fewer tiles, the foot is More, Apps, avatar. */
export const Tight480: Story = { args: { height: 480 } };
/** The 60px icon rail, More has a tooltip. Drag the slider to resize live. */
export const CompactResizable: Story = { args: { height: 480, mode: 'compact' } };

const EXTRAS: RailFootEntry[] = [
  { id: 'shield', label: 'Conditions', icon: 'shield-check', onSelect: () => undefined },
  { id: 'mastery', label: 'Mastery', icon: 'medal', onSelect: () => undefined },
  {
    id: 'bell',
    label: 'Notifications',
    icon: 'bell',
    fill: true,
    onSelect: () => undefined,
    count: 3,
    badge: 3,
    countLabel: '3 unread',
  },
  { id: 'settings', label: 'Settings', icon: 'gear', onSelect: () => undefined },
];

function ExtrasStage() {
  const [h, setH] = useState(520);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ font: '600 12px var(--font)', color: 'var(--color-text-muted)' }}>
        Rail height {h}px: the bottom extras collapse first (settings, bell, mastery, shield), only
        then the nav from the end. Apps and the avatar stay.{' '}
        <input
          type="range"
          min={200}
          max={700}
          value={h}
          onChange={(e) => setH(Number(e.target.value))}
        />
      </label>
      <div style={{ height: h, display: 'flex', background: 'var(--color-bg)' }}>
        <Rail
          brand={<Avatar name="Spotter" size={40} />}
          labelled
          overflow={{
            entries: ENTRIES.slice(0, 3),
            footEntries: EXTRAS,
            moreLabel: c.navMore,
            moreCountLabel: c.unread,
            renderMenu: function Menu({ hiddenNav, hiddenFoot, open, onClose, anchorRef }) {
              return (
                <MoreMenu
                  presentation="popover"
                  open={open}
                  onClose={onClose}
                  anchorRef={anchorRef}
                  title={c.navMore}
                  items={hiddenNav}
                  extraItems={hiddenFoot}
                />
              );
            },
          }}
          foot={
            <>
              <RailItem icon="squares-four" label={c.navApps} tooltip={c.navApps} />
              <Avatar name="Iryna Koval" size={34} />
            </>
          }
        />
      </div>
    </div>
  );
}

/** Foot extras (Gym's shield, mastery, bell, settings) collapse into More together, before the nav does. */
export const FootExtrasFirst: Story = { render: () => <ExtrasStage /> };
