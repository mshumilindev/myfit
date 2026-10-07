import type { Meta, StoryObj } from '@storybook/react-vite';
import { BannerStudy } from './BannerStudy';
const meta = {
  title: 'Studies/To do · 20 concepts',
  component: BannerStudy,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BannerStudy>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Playground: Story = {};
