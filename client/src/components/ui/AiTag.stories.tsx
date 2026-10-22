import type { Meta, StoryObj } from '@storybook/react-vite';
import { AiTag } from './AiTag';

const meta = { title: 'Kit/AiTag', component: AiTag, args: { label: 'AI' } } satisfies Meta<
  typeof AiTag
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const LongWord: Story = { args: { label: 'Dirbtinis intelektas' } };
