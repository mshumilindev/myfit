import type { Meta, StoryObj } from '@storybook/react-vite';
import { SettingsView } from './SettingsView';
import { PageFrame } from '../stories/PageFrame';
import { seedPage } from '../stories/fixtures';

/** The Settings screen with a few weeks of seeded training data. */
const meta = {
  title: 'Pages/Settings',
  component: SettingsView,
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
} satisfies Meta<typeof SettingsView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { onClose: () => undefined } };
