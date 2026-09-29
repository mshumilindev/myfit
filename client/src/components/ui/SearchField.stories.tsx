import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SearchField } from './SearchField';
import { Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/SearchField',
  component: SearchField,
  args: {
    value: '',
    onChange: () => undefined,
    placeholder: 'Search widgets',
    clearLabel: 'Clear',
  },
} satisfies Meta<typeof SearchField>;
export default meta;
type Story = StoryObj<typeof meta>;

function Live({ initial, placeholder }: { initial: string; placeholder: string }) {
  const [v, setV] = useState(initial);
  return <SearchField value={v} onChange={setV} placeholder={placeholder} clearLabel="Clear" />;
}

export const Playground: Story = {};

/** Empty, typed (with clear), long text, and a translated placeholder. */
export const States: Story = {
  render: () => (
    <Stack>
      <div style={{ width: 350 }}>
        <Live initial="" placeholder="Search widgets" />
      </div>
      <div style={{ width: 350 }}>
        <Live initial="sleep" placeholder="Search widgets" />
      </div>
      <div style={{ width: 350 }}>
        <Live
          initial="a very long query that runs past the edge of the field"
          placeholder="Search widgets"
        />
      </div>
      <div style={{ width: 350 }}>
        <Live initial="" placeholder="Пошук віджетів" />
      </div>
    </Stack>
  ),
};
