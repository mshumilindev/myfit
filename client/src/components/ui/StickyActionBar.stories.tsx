import type { Meta, StoryObj } from '@storybook/react-vite';
import { StickyActionBar } from './StickyActionBar';
import { Button } from './Button';
import { LocaleMatrix } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/StickyActionBar',
  component: StickyActionBar,
  parameters: { layout: 'fullscreen' },
  args: { children: null },
} satisfies Meta<typeof StickyActionBar>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Pinned under a scrolling page: Cancel · wider primary, safe-area padding. */
export const Page: Story = {
  render: () => (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: 16, color: 'var(--color-text-muted)' }}>
        {Array.from({ length: 30 }, (_, i) => (
          <p key={i}>Scrolling content row {i + 1}</p>
        ))}
      </div>
      <StickyActionBar>
        <Button variant="secondary">Cancel</Button>
        <Button variant="fill">Save illness</Button>
      </StickyActionBar>
    </div>
  ),
};

/** One full-width action, with a note line. */
export const SingleWithNote: Story = {
  render: () => (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      <StickyActionBar note="Past activity — no timer needed">
        <Button variant="fill">Log the past</Button>
      </StickyActionBar>
    </div>
  ),
};

/** Web side-panel foot: right-aligned, on the panel surface. */
export const Panel: Story = {
  render: () => (
    <div style={{ width: 720, background: 'var(--color-surface)' }}>
      <StickyActionBar variant="panel" surface="surface">
        <Button variant="secondary">Cancel</Button>
        <Button variant="fill">Save changes</Button>
      </StickyActionBar>
    </div>
  ),
};

/** Long labels in five locales (ellipsis inside the buttons). */
export const LongText: Story = {
  render: () => (
    <LocaleMatrix
      width={390}
      render={(t) => (
        <StickyActionBar>
          <Button variant="secondary">{t.cancel}</Button>
          <Button variant="fill">{t.hlSaveChanges}</Button>
        </StickyActionBar>
      )}
    />
  ),
};
