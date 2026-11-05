import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage } from '../stories/SkStage';
import { SkSearchField } from './SkSearchField';

const meta = {
  title: 'Store/SkSearchField',
  component: SkSearchField,
  args: { value: '', placeholder: 'Search' },
} satisfies Meta<typeof SkSearchField>;
export default meta;
type Story = StoryObj<typeof meta>;

function Live({ initial }: { initial: string }) {
  const [v, setV] = useState(initial);
  return (
    <SkSearchField
      value={v}
      placeholder="Search apps and add-ons"
      clearLabel="Clear search"
      onChange={setV}
      onClear={() => setV('')}
    />
  );
}

export const States: Story = {
  render: () => (
    <SkStage width="phone">
      <Live initial="" />
      <Live initial="sleep" />
      <Live initial="a very long query that does not fit into the field and must scroll inside it" />
    </SkStage>
  ),
};
