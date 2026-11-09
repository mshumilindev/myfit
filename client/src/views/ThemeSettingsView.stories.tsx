import type { Meta, StoryObj } from '@storybook/react-vite';
import { ThemeSettingsView } from './ThemeSettingsView';
import { PageFrame } from '../stories/PageFrame';
import { seedPage } from '../stories/fixtures';

/** Theme settings (Studio): mode rows and the nine accent swatches; Save lights up on a change, Reset asks first. */
const meta = {
  title: 'Pages/ThemeSettings',
  component: ThemeSettingsView,
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
} satisfies Meta<typeof ThemeSettingsView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { onClose: () => undefined } };
