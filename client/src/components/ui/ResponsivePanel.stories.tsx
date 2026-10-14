import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef, useState } from 'react';
import { Button } from './Button';
import { ResponsivePanel } from './ResponsivePanel';

function Demo({ startOpen }: { startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const ref = useRef<HTMLSpanElement>(null);
  return (
    <div style={{ minHeight: 360, display: 'flex', justifyContent: 'flex-end' }}>
      <span ref={ref}>
        <Button variant="secondary" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          Filters
        </Button>
      </span>
      <ResponsivePanel
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={ref}
        label="Filters"
        title="Filters"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Clear all
            </Button>
            <Button variant="primary" onClick={() => setOpen(false)}>
              Show 12
            </Button>
          </>
        }
      >
        <p style={{ margin: 0 }}>Popover from the Coach breakpoint up, bottom sheet on a phone.</p>
      </ResponsivePanel>
    </div>
  );
}

/** Coach kit: one panel, a popover on desktop and a bottom sheet on a phone (export menu, filters). */
const meta = {
  title: 'Coach/Responsive panel',
  component: Demo,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = { args: { startOpen: true } };
export const Closed: Story = { args: { startOpen: false } };
