import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage } from '../stories/SkStage';
import { SkSectionHeader, SkSectionLink } from './SkSectionHeader';

const meta = {
  title: 'Store/SkSectionHeader',
  component: SkSectionHeader,
  args: { title: 'Title' },
} satisfies Meta<typeof SkSectionHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = {
  render: () => (
    <SkStage width="phone">
      <SkSectionHeader title="Recommended" aside={<SkSectionLink>See all</SkSectionLink>} />
      <SkSectionHeader title="Apps" />
      <SkSectionHeader
        title="A very long section title that has to wrap on a narrow phone screen"
        aside={<SkSectionLink>See all</SkSectionLink>}
      />
    </SkStage>
  ),
};
