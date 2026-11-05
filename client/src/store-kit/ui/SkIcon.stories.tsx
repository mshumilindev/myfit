import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage, SkStageRow } from '../stories/SkStage';
import { SK_ICON_PATHS } from './SkIcon.paths';
import { SkIcon, type SkIconName } from './SkIcon';

const meta = {
  title: 'Store/SkIcon',
  component: SkIcon,
  args: { name: 'search' },
  argTypes: { name: { control: 'select', options: Object.keys(SK_ICON_PATHS) } },
} satisfies Meta<typeof SkIcon>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <SkStage>
      <SkIcon {...args} />
    </SkStage>
  ),
};

/** The whole set, regular (24) and small (16), light and dark. */
export const AllIcons: Story = {
  render: () => (
    <SkStage>
      <SkStageRow label="24">
        {(Object.keys(SK_ICON_PATHS) as SkIconName[]).map((n) => (
          <SkIcon key={n} name={n} label={n} />
        ))}
      </SkStageRow>
      <SkStageRow label="16 (small)">
        {(Object.keys(SK_ICON_PATHS) as SkIconName[]).map((n) => (
          <SkIcon key={n} name={n} small label={n} />
        ))}
      </SkStageRow>
    </SkStage>
  ),
};
