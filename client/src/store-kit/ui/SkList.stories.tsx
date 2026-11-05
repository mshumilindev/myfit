import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage } from '../stories/SkStage';
import { SkBtn } from './SkBtn';
import { SkList } from './SkList';
import { SkRow } from './SkRow';

const meta = { title: 'Store/SkList', component: SkList } satisfies Meta<typeof SkList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Grouped: Story = {
  render: () => (
    <SkStage width="phone">
      <SkList>
        {['Health', 'Sleep', 'Atlas'].map((n) => (
          <SkRow key={n} name={n} desc="Short description" action={<SkBtn size="s">Add</SkBtn>} />
        ))}
      </SkList>
    </SkStage>
  ),
};

export const SingleRow: Story = {
  render: () => (
    <SkStage width="phone">
      <SkList>
        <SkRow name="Only one" desc="No trailing separator" />
      </SkList>
    </SkStage>
  ),
};
