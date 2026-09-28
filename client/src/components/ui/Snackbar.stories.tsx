import type { Meta, StoryObj } from '@storybook/react-vite';
import { Snackbar } from './Snackbar';
import { LocaleMatrix, Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/Snackbar',
  component: Snackbar,
  args: {
    text: 'Dance · 120 min logged',
    sub: 'Counts toward today’s load',
    tone: 'accent',
    position: 'inline',
    action: { label: 'Undo', ariaLabel: 'Undo logging Dance', onClick: () => undefined },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Snackbar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithUndo: Story = {};

/** Tones, no action, one line, long text. */
export const Variants: Story = {
  render: () => (
    <Stack>
      <Snackbar
        position="inline"
        tone="sport"
        text="Tennis · 60 min logged"
        action={{ label: 'Undo', onClick: () => undefined }}
      />
      <Snackbar position="inline" tone="rest" text="Sauna · 20 min logged" sub="Recovery" />
      <Snackbar position="inline" tone="ok" icon="check-circle" text="Saved" />
      <Snackbar
        position="inline"
        tone="accent"
        text="Sauna won’t be suggested after workouts any more — you can turn it back on in Settings"
        action={{ label: 'Undo', onClick: () => undefined }}
      />
    </Stack>
  ),
};

/** Fixed: floats above the bottom edge (safe-area aware); right-aligned on web. */
export const Fixed: Story = {
  parameters: { layout: 'fullscreen' },
  args: { position: 'fixed' },
  decorators: [
    (Story) => (
      <div style={{ height: '100vh' }}>
        <Story />
      </div>
    ),
  ],
};

/** "Undo" in five locales. */
export const LongText: Story = {
  render: () => (
    <LocaleMatrix
      render={(t) => (
        <Snackbar
          position="inline"
          tone="accent"
          text={t.laLoggedToast(t.actType.dance ?? 'Dance', `120 ${t.minShort}`)}
          action={{ label: t.undo, ariaLabel: t.laUndoAria('Dance'), onClick: () => undefined }}
        />
      )}
    />
  ),
};
