import type { Meta, StoryObj } from '@storybook/react-vite';
import { InjuryView } from './InjuryView';
import { PageFrame } from '../stories/PageFrame';
import { seedPage } from '../stories/fixtures';

/** The Injury screen with a few weeks of seeded training data. */
const meta = {
  title: 'Pages/Injury',
  component: InjuryView,
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
} satisfies Meta<typeof InjuryView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { onClose: () => undefined } };
