import type { Meta, StoryObj } from '@storybook/react-vite';
import { SyncStatus } from './SyncStatus';
import { LocaleMatrix, Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/SyncStatus',
  component: SyncStatus,
  args: { state: 'syncing', children: 'Syncing' },
} satisfies Meta<typeof SyncStatus>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Every state. Offline and slow are calm (neutral); only failed is tinted as an error. */
export const States: Story = {
  render: () => (
    <Stack>
      <SyncStatus state="synced">Synced</SyncStatus>
      <SyncStatus state="syncing">Syncing</SyncStatus>
      <SyncStatus state="saving">Saving…</SyncStatus>
      <SyncStatus state="slow" onRetry={() => undefined} retryLabel="Retry">
        Slow connection — using saved data
      </SyncStatus>
      <SyncStatus state="offline" onRetry={() => undefined} retryLabel="Retry">
        Offline — changes will sync later
      </SyncStatus>
      <SyncStatus state="failed" onRetry={() => undefined} retryLabel="Retry">
        Sync failed
      </SyncStatus>
    </Stack>
  ),
};

/** Very long text truncates inside the chip instead of widening the page. */
export const LongText: Story = {
  render: () => (
    <div style={{ width: 260 }}>
      <SyncStatus state="offline" onRetry={() => undefined} retryLabel="Retry">
        Offline — working from saved data, your changes are queued and will sync later on
      </SyncStatus>
    </div>
  ),
};

/** Floating variant: top-centre, the wrapper ignores pointer events (only Retry is tappable). */
export const Floating: Story = {
  render: () => (
    <div style={{ position: 'relative', height: 120, transform: 'translateZ(0)' }}>
      <SyncStatus state="slow" floating onRetry={() => undefined} retryLabel="Retry">
        Slow connection — using saved data
      </SyncStatus>
    </div>
  ),
};

export const LocaleStates: Story = {
  render: () => (
    <LocaleMatrix
      render={(t) => (
        <Stack gap={8}>
          <SyncStatus state="syncing">{t.syncing}</SyncStatus>
          <SyncStatus state="slow" onRetry={() => undefined} retryLabel={t.retry}>
            {t.syncSlow}
          </SyncStatus>
          <SyncStatus state="offline" onRetry={() => undefined} retryLabel={t.retry}>
            {t.syncOfflineWork}
          </SyncStatus>
        </Stack>
      )}
    />
  ),
};
