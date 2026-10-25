import type { Meta, StoryObj } from '@storybook/react-vite';
import { ThemesView } from './ThemesView';
import { PageFrame } from '../stories/PageFrame';
import { seedPage } from '../stories/fixtures';

/** The Themes screen with a few weeks of seeded training data. */
const meta = {
  title: 'Pages/Themes',
  component: ThemesView,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <PageFrame>
        <Story />
      </PageFrame>
    ),
  ],
  loaders: [
    () => {
      seedPage();
      return {};
    },
  ],
} satisfies Meta<typeof ThemesView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { onClose: () => undefined } };
