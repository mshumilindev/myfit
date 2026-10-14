import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Popover, type PopoverProps } from './Popover';
import { Button } from './Button';

const meta = {
  title: 'Kit/Popover',
  component: Popover,
  parameters: { layout: 'fullscreen', viewport: { value: 'web' } },
  args: { open: false, onClose: () => undefined, anchorRef: { current: null }, children: null },
} satisfies Meta<typeof Popover>;
export default meta;
type Story = StoryObj<typeof meta>;

function Demo({
  label,
  startOpen = true,
  ...props
}: Partial<PopoverProps> & { label: string; startOpen?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(startOpen);
  return (
    <>
      <span ref={ref} style={{ display: 'inline-flex' }}>
        <Button variant="secondary" onClick={() => setOpen((o) => !o)}>
          {label}
        </Button>
      </span>
      <Popover {...props} open={open} onClose={() => setOpen(false)} anchorRef={ref} label={label}>
        <div style={{ padding: 16, width: 240 }}>
          <strong>{label}</strong>
          <p style={{ margin: '8px 0 0', fontSize: 13 }}>
            Esc, an outside press or the scrim closes it; focus returns to the trigger.
          </p>
        </div>
      </Popover>
    </>
  );
}

const Stage = ({ children, align = 'center' }: { children: React.ReactNode; align?: string }) => (
  <div
    style={{
      height: 420,
      display: 'flex',
      justifyContent: align,
      alignItems: 'center',
      padding: 24,
    }}
  >
    {children}
  </div>
);

/** Below the anchor, aligned to its start. */
export const Bottom: Story = {
  render: () => (
    <Stage>
      <Demo label="Bottom start" side="bottom" align="start" />
    </Stage>
  ),
};

/** Right of a rail item (the Coach mode popover) with an arrow. */
export const RightWithArrow: Story = {
  render: () => (
    <Stage align="flex-start">
      <Demo label="Right of the rail" side="right" align="center" arrow />
    </Stage>
  ),
};

/** Collision: the anchor sits at the viewport's right edge, the panel clamps inside; a tight top flips below. */
export const Collision: Story = {
  render: () => (
    <div
      style={{
        height: 420,
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'flex-start',
        padding: 8,
      }}
    >
      <Demo label="Edge (prefers top, flips)" side="top" align="end" />
    </div>
  ),
};

/** With a dim scrim: outside press closes, nothing underneath is hit. */
export const WithScrim: Story = {
  render: () => (
    <Stage>
      <Demo label="Dim scrim" scrim="dim" arrow />
    </Stage>
  ),
};
