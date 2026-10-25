import type { Meta, StoryObj } from '@storybook/react-vite';
import { ThemesView } from './ThemesView';
import { PageFrame } from '../stories/PageFrame';
import { seedPage } from '../stories/fixtures';

/** The Themes screen: the theme in use big, the others and the places held for future themes as landscape tiles. */
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
