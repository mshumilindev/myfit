import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { IconTile } from '../components/ui/IconTile';
import { Tag } from '../components/ui/Tag';
import { ShellLauncher } from '../components/ShellLauncher';
import type { StoreState } from '../store';

/**
 * Coach identity: the tourmaline accent ramp, how primary / selected / share / note read next to
 * it, and the suite launcher with Coach as the current app.
 */
const meta = {
  title: 'Pages/Coach/Identity',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const STEPS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

/** Re-skins the document root like the Coach shell does (portals follow). */
function CoachScope({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add('theme-coach');
    return () => document.documentElement.classList.remove('theme-coach');
  }, []);
  return <div className="app-coach">{children}</div>;
}

export const Ramp: Story = {
  render: () => (
    <CoachScope>
      <div style={{ padding: 24, background: 'var(--color-bg)', minHeight: '100vh' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STEPS.map((n) => (
            <div
              key={n}
              style={{
                width: 72,
                height: 72,
                borderRadius: 12,
                background: `var(--color-accent-${n})`,
                // the lighter half of the ramp takes dark ink; labels are large text (>= 18.7px bold)
                color: n >= 700 ? 'var(--color-text)' : 'var(--color-bg)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 20,
                fontWeight: 700,
              }}
            >
              {n}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Tag tone="accent">Selected</Tag>
          <Tag tone="share">Shared program</Tag>
          <Tag tone="note">Trainer note</Tag>
          <Tag tone="ok">Done</Tag>
          <Tag tone="danger">Missed</Tag>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <IconTile tone="coach" size={48} icon="compass" />
          <IconTile tone="gym" size={48} icon="barbell" />
          <IconTile tone="apex" size={48} icon="trophy" />
          <IconTile tone="people" size={48} icon="user-focus" />
          <IconTile tone="kcal" size={48} icon="fork-knife" />
          <IconTile tone="learn" size={48} icon="graduation-cap" />
        </div>
        <Card tone="accent" emphasis="hero" style={{ marginTop: 24, padding: 16 }}>
          Hero card in the Coach accent
        </Card>
      </div>
    </CoachScope>
  ),
};

/** The suite launcher opened from the Coach rail / More sheet. Coach is the current tile. */
export const LauncherInCoach: Story = {
  render: function Render() {
    const noop = () => undefined;
    return (
      <CoachScope>
        <ShellLauncher
          store={{ workouts: [], queue: [] } as unknown as StoreState}
          now={Date.now()}
          current="coach"
          peopleLabel="People"
          peopleDesc="Your clients & profile."
          activeChallenges={2}
          notifUnread={3}
          onGym={noop}
          onApex={noop}
          onRoster={noop}
          onNutrition={noop}
          nutritionEnabled
          onLearn={noop}
          onClose={noop}
        />
      </CoachScope>
    );
  },
};
