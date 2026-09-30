import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Pager } from './Pager';

const meta = {
  title: 'Kit/Pager',
  component: Pager,
  args: { page: 0, maxPage: 3, onPage: () => undefined },
} satisfies Meta<typeof Pager>;
export default meta;
type Story = StoryObj<typeof meta>;

function Demo({ maxPage }: { maxPage: number }) {
  const [page, setPage] = useState(0);
  return <Pager page={page} maxPage={maxPage} onPage={setPage} />;
}

/** Few pages. */
export const Short: Story = { render: () => <Demo maxPage={3} /> };

/** Many pages — same control. */
export const Long: Story = { render: () => <Demo maxPage={24} /> };
