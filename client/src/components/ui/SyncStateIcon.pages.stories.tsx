import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TodayView } from '../../views/TodayView';
import { useStore } from '../../store';
import { useT } from '../../i18n';
import { PageFrame } from '../../stories/PageFrame';
import { seedPage, storyShell } from '../../stories/fixtures';
import { Notice } from './Notice';
import { Button } from './Button';
import { SyncStateIcon, type SyncIconState } from './SyncStateIcon';

/**
 * SPO-375 mock-ups: the REAL Today screen (seeded fixtures) with the new icon inserted where it would live:
 * the top-bar sync slot (replacing the old dot chip) and the kit Notice strip. The floating SyncStatus chip is retired by this design (SPO-122: it covers the header).
 * The real elements stay in place; only their icon slot is swapped by a portal, so nothing is redrawn.
 */
function useSlot(selector: string, hide: boolean): HTMLElement | null {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let stop = false;
    let made: HTMLElement | null = null;
    const tick = () => {
      if (stop) return;
      const host = document.querySelector<HTMLElement>(selector);
      if (!host) {
        requestAnimationFrame(tick);
        return;
      }
      if (hide) {
        made = document.createElement('span');
        made.className = 'spo375-slot';
        host.after(made);
        host.style.display = 'none';
        setSlot(made);
      } else {
        host.replaceChildren();
        setSlot(host);
      }
    };
    tick();
    return () => {
      stop = true;
      made?.remove();
    };
  }, [selector, hide]);
  return slot;
}

function useAfter(selector: string): HTMLElement | null {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let stop = false;
    let made: HTMLElement | null = null;
    const tick = () => {
      if (stop) return;
      const host = document.querySelector<HTMLElement>(selector);
      if (!host) {
        requestAnimationFrame(tick);
        return;
      }
      made = document.createElement('div');
      host.after(made);
      setEl(made);
    };
    tick();
    return () => {
      stop = true;
      made?.remove();
    };
  }, [selector]);
  return el;
}

function Mock({ state, count }: { state: SyncIconState; count?: number }) {
  const store = useStore();
  const { t } = useT();
  const topbar = useSlot('.td-topbar-actions .sync-chip', true);
  const strip = useAfter('.pane-main .td-topbar');
  const noticeIcon = useSlot('.spo375-notice i', true);
  const label =
    state === 'offline'
      ? t.syncOfflineWork
      : state === 'slow'
        ? t.syncSlow
        : state === 'failed'
          ? t.syncProblem
          : state === 'saving'
            ? t.saving
            : t.syncing;
  return (
    <>
      <TodayView shell={storyShell} store={store} />
      {topbar && createPortal(<SyncStateIcon state={state} count={count} label={label} />, topbar)}
      {strip &&
        createPortal(
          <Notice
            className="spo375-notice"
            tone={state === 'failed' ? 'danger' : 'neutral'}
            icon="cloud-slash"
            trail={
              state === 'synced' || state === 'syncing' ? undefined : (
                <Button variant="link" size="sm">
                  {t.retry}
                </Button>
              )
            }
          >
            {label}
          </Notice>,
          strip,
        )}
      {noticeIcon &&
        createPortal(<SyncStateIcon state={state} count={count} size="sm" />, noticeIcon)}
    </>
  );
}

const meta = {
  title: 'Pages/SPO-375 sync state icon',
  component: Mock,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <PageFrame>
        <Story />
      </PageFrame>
    ),
  ],
  loaders: [
    () => {
      seedPage();
      return {};
    },
  ],
} satisfies Meta<typeof Mock>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OfflineQueued: Story = { args: { state: 'offline', count: 3 } };
export const Syncing: Story = { args: { state: 'syncing', count: 3 } };
export const Slow: Story = { args: { state: 'slow' } };
export const Failed: Story = { args: { state: 'failed', count: 1 } };
export const Synced: Story = { args: { state: 'synced' } };
