import type { Meta, StoryObj } from '@storybook/react-vite';
import { EquipmentDetailView } from './EquipmentDetailView';
import { PageFrame } from '../stories/PageFrame';
import { seedPage, storyShell } from '../stories/fixtures';

/** One piece of equipment from the catalog. */
const meta = {
  title: 'Pages/Equipment detail',
  component: EquipmentDetailView,
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
} satisfies Meta<typeof EquipmentDetailView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    itemId: 'barbell-olympic',
    shell: storyShell,
    onClose: () => undefined,
  },
};
