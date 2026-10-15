import type { Meta, StoryObj } from '@storybook/react-vite';
import { SidesChip } from './SidesChip';

/**
 * "×2 per hand" (SPO-13): the kit Chip with a lead tab, shown for a pair of dumbbells and for a one-side-at-a-time
 * lift. The row is the session's exercise-chip line (one line, never wraps the chip's own text).
 */
const meta = {
  title: 'Components/SidesChip',
  component: SidesChip,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof SidesChip>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Dumbbells: weight is per hand. */
export const PerHand: Story = {
  args: {
    ex: { name: 'Incline Dumbbell Press', equipment: ['dumbbell'] },
    onClick: () => undefined,
  },
};
/** One side at a time. */
export const OneSide: Story = {
  args: {
    ex: { name: 'Single-Arm Dumbbell Row', equipment: ['dumbbell'] },
    onClick: () => undefined,
  },
};
/** Past session: read-only (no tap). */
export const ReadOnly: Story = {
  args: { ex: { name: 'Incline Dumbbell Press', equipment: ['dumbbell'] } },
};
