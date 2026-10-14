import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppRail, type RailNavItem } from '../AppRail';
import { CoachShell } from '../../coach/CoachApp';
import { COACH_WIDE_BREAKPOINT, useMinWidth } from '../ui/breakpoints';
import type { SuiteApp } from './useSuiteAccount';

/**
 * Regression story for "switching apps must not move the buttons": all six rails side by side,
 * same nav (4 entries), same height. Logo, first tile, pitch, tile size, label and the foot
 * (Apps, avatar) must line up pixel for pixel across Gym, Apex, People, Nutrition, Learn and
 * Coach; only the accent colour changes. Use the Web 1280 viewport (labelled) and Tablet (60px).
 * Coach is the REAL `CoachShell` (its own rail, foot and avatar), clipped to the rail column: a
 * transformed wrapper makes the shell's fixed layout fill the 640px box. The avatar and Apps
 * must sit at the same distance from the bottom edge in all six (railGeometry.test.ts and
 * suiteNav.test.tsx pin the same numbers).
 */
const NAV: RailNavItem[] = [
  { id: 'a', icon: 'house', label: 'Today' },
  { id: 'b', icon: 'users', label: 'Clients' },
  { id: 'c', icon: 'calendar-blank', label: 'Schedule' },
  { id: 'd', icon: 'chat-circle', label: 'Chat' },
];
const APPS: { name: string; app: SuiteApp; skin: string }[] = [
  { name: 'Gym', app: 'gym', skin: '' },
  { name: 'Apex', app: 'apex', skin: 'app-apex apex-app' },
  { name: 'People', app: 'roster', skin: 'app-roster apex-app' },
  { name: 'Nutrition', app: 'nutrition', skin: 'app-nutrition apex-app' },
  { name: 'Learn', app: 'learn', skin: 'app-learn apex-app' },
];

function CoachColumn({ wide }: { wide: boolean }) {
  return (
    <div
      style={{
        position: 'relative',
        height: 640,
        width: wide ? 88 : 60,
        overflow: 'hidden',
        transform: 'translateZ(0)',
      }}
    >
      <CoachShell
        role="trainer"
        name="Iryna Koval"
        route={{ screen: 'agenda' }}
        onNavigate={() => undefined}
        onExitToWorkouts={() => undefined}
        onOpenProfile={() => undefined}
        onOpenShell={() => undefined}
      />
    </div>
  );
}

function Row() {
  const wide = useMinWidth(COACH_WIDE_BREAKPOINT);
  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      {APPS.map((a) => (
        <div key={a.name}>
          <div
            style={{ font: '600 12px var(--font)', marginBottom: 8, color: 'var(--color-text)' }}
          >
            {a.name}
          </div>
          <div className={a.skin} style={{ display: 'flex', height: 640 }}>
            <AppRail
              app={a.app}
              nav={NAV}
              activeId="a"
              onNav={() => undefined}
              onOpenShell={() => undefined}
              onOpenNotifications={() => undefined}
              onOpenProfile={() => undefined}
            />
          </div>
        </div>
      ))}
      <div>
        <div style={{ font: '600 12px var(--font)', marginBottom: 8, color: 'var(--color-text)' }}>
          Coach (real shell)
        </div>
        <CoachColumn wide={wide} />
      </div>
    </div>
  );
}

const meta = {
  title: 'Pages/Suite/Rails side by side',
  parameters: { layout: 'padded', viewport: { value: 'web' } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const SixRails: Story = { render: () => <Row /> };
