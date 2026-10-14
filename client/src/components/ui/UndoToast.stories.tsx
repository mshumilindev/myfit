import type { Meta, StoryObj } from '@storybook/react-vite';
import { UndoToast } from './UndoToast';

const meta = {
  title: 'Coach/Undo toast',
  component: UndoToast,
  parameters: { layout: 'padded' },
  args: {
    text: 'Message deleted',
    undoLabel: 'Undo',
    countdownLabel: 'Undo is available for 8 seconds',
    onUndo: () => undefined,
  },
  decorators: [
    (S) => (
      <div style={{ maxWidth: 420 }}>
        <S />
      </div>
    ),
  ],
} satisfies Meta<typeof UndoToast>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Runs the real 8 s countdown on load. */
export const Running: Story = {};
/** Frozen with 3 s left (screenshots). */
export const ThreeSecondsLeft: Story = { args: { frozenLeftMs: 3000 } };
export const ChatCleared: Story = {
  args: { text: 'Chat cleared', icon: 'envelope', frozenLeftMs: 6000 },
};
