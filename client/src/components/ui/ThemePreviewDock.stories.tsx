import type { Meta, StoryObj } from '@storybook/react-vite';
import { ThemePreviewDock } from './ThemePreviewDock';

/** The bar under a previewed theme (SPO-355). Not a modal: it never covers the screen, only Keep / Use close it. */
const meta = {
  title: 'Kit/ThemePreviewDock',
  component: ThemePreviewDock,
  parameters: { layout: 'fullscreen' },
  args: {
    themeName: 'Cyberpunk',
    newLabel: 'New',
    hint: 'Look around the app. Nothing is saved until you confirm.',
    label: 'Theme preview',
    keepLabel: 'Keep current',
    useLabel: 'Use Cyberpunk',
    onKeep: () => undefined,
    onUse: () => undefined,
  },
} satisfies Meta<typeof ThemePreviewDock>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Longest strings (pl): buttons share the row, the hint wraps. */
export const LongStrings: Story = {
  args: {
    newLabel: 'Nowy',
    hint: 'Rozejrzyj się po aplikacji. Nic nie zapisze się, dopóki nie potwierdzisz.',
    keepLabel: 'Zostaw obecny',
    useLabel: 'Użyj motywu Cyberpunk',
  },
};
