import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SyncStateIcon, type SyncIconState } from './SyncStateIcon';
import { Stack } from '../../stories/LocaleMatrix';

const STATES: SyncIconState[] = [
  'synced',
  'syncing',
  'saving',
  'slow',
  'offline',
  'stale',
  'failed',
  'locked',
];

const meta = {
  title: 'Kit/SyncStateIcon',
  component: SyncStateIcon,
  args: { state: 'syncing', label: 'Syncing' },
} satisfies Meta<typeof SyncStateIcon>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Every state at every size: each has its own shape, so colour is never the only signal. */
export const States: Story = {
  render: () => (
    <Stack>
      {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
        <div key={size} style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          {STATES.map((s) => (
            <SyncStateIcon key={s} state={s} size={size} label={s} />
          ))}
        </div>
      ))}
    </Stack>
  ),
};

/** The state name as a tooltip: hover on a mouse, tap on touch (it hides itself). */
export const Tooltip: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 24, alignItems: 'center', padding: '48px 24px' }}>
      {STATES.map((s) => (
        <SyncStateIcon key={s} state={s} size="xl" label={s} tooltip />
      ))}
    </div>
  ),
};

/** The queued-changes count rides on any state (offline, syncing, slow, failed). */
export const WithCount: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
      <SyncStateIcon state="offline" count={3} label="Offline" size="lg" />
      <SyncStateIcon state="syncing" count={12} label="Syncing" size="lg" />
      <SyncStateIcon state="slow" count={1} label="Slow connection" size="lg" />
      <SyncStateIcon state="failed" count={2} label="Sync problem" size="lg" />
    </div>
  ),
};

/** One icon walking through all states: each step is the same line turning into the next shape. */
export const Morph: Story = {
  render: function MorphDemo() {
    const [i, setI] = useState(0);
    useEffect(() => {
      const id = setInterval(() => setI((n) => (n + 1) % STATES.length), 1800);
      return () => clearInterval(id);
    }, []);
    return <SyncStateIcon state={STATES[i]} size="lg" label={STATES[i]} />;
  },
};

/** Any state to any state: pick a row (from) then a column (to) in the page, or just click the icons. */
export const TransitionMatrix: Story = {
  render: function MatrixDemo() {
    const [s, setS] = useState<SyncIconState>('synced');
    return (
      <Stack>
        <SyncStateIcon state={s} size="lg" label={s} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STATES.map((t) => (
            <button key={t} type="button" onClick={() => setS(t)}>
              {t}
            </button>
          ))}
        </div>
      </Stack>
    );
  },
};
