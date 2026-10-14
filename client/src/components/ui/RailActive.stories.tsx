import type { Meta, StoryObj } from '@storybook/react-vite';
import { Rail, RailItem } from './Rail';
import { Avatar } from './Avatar';

/**
 * Rail item states on the labelled (88px) and compact (60px) rails.
 *
 * Expected sizes (px) to check against the render:
 * - labelled: rail 88 wide, tile 72 x 64 at x = 8, pitch 69.6 (64 + 5.6 gap), 13px label.
 * - compact: rail 60 wide, tile 44 x 44 at x = 8, pitch 49.6, icon only (tooltip on hover/focus).
 * - active: SAME box as inactive (no layout shift). Tinted rounded tile (accent 14%, radius 16) with
 *   a 1px accent ring (accent 40%, inset shadow), icon filled, label accent-300. Nothing else: no bar
 *   or notch at the rail's edge.
 * - hover: state-hover background, neutral-300 label. Focus-visible: 2px accent outline, 2px offset.
 * Accent follows the app (tourmaline in Coach via .app-coach / theme-coach).
 */
const meta = {
  title: 'Coach/Rail Active',
  component: Rail,
  parameters: { layout: 'padded', viewport: { value: 'web' } },
  args: { brand: <Avatar name="S" size={40} />, children: null },
} satisfies Meta<typeof Rail>;
export default meta;
type Story = StoryObj<typeof meta>;

const hover = { background: 'var(--state-hover)', color: 'var(--color-neutral-300)' };

function Col({ mode }: { mode: 'labelled' | 'compact' }) {
  return (
    <div style={{ height: 460, display: 'flex' }} className="app-coach">
      <Rail
        brand={<Avatar name="S" size={40} />}
        labelled={mode === 'labelled'}
        compact={mode === 'compact'}
        ariaLabel={mode}
        foot={<Avatar name="Iryna Koval" size={34} />}
      >
        <RailItem icon="sun-horizon" label="Today" active fillWhenActive />
        <RailItem icon="user-focus" label="Clients" />
        <RailItem icon="calendar-blank" label="Schedule" style={hover} data-state="hover" />
        <RailItem icon="calendar-dots" label="Week" data-state="focus" />
        <RailItem icon="envelope" label="Chat" count={5} countLabel="5 unread" />
      </Rail>
    </div>
  );
}

/** Active, inactive, hover (forced), focus-visible (play step focuses Week), badge. */
export const Labelled: Story = {
  render: () => <Col mode="labelled" />,
  play: async ({ canvasElement }) => {
    canvasElement.querySelector<HTMLElement>('[data-state="focus"]')?.focus();
  },
};

export const Compact: Story = {
  render: () => <Col mode="compact" />,
  play: async ({ canvasElement }) => {
    canvasElement.querySelector<HTMLElement>('[data-state="focus"]')?.focus();
  },
};

export const SideBySide: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 48 }}>
      <Col mode="labelled" />
      <Col mode="compact" />
    </div>
  ),
};
