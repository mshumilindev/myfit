import type { Meta, StoryObj } from '@storybook/react-vite';
import { Gallery } from '../components/ui/Gallery';

/** The in-app #/uikit screen (tokens + core primitives), rendered as-is. */
const meta = {
  title: 'Foundations/Tokens & in-app gallery',
  component: Gallery,
  parameters: { layout: 'fullscreen' },
  args: { onClose: () => undefined },
} satisfies Meta<typeof Gallery>;
export default meta;

export const Gallery_: StoryObj<typeof meta> = { name: 'Gallery' };
