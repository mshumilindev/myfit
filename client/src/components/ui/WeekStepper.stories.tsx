import type { Meta, StoryObj } from '@storybook/react-vite';
import { WeekStepper } from './WeekStepper';

const meta = {
  title: 'Kit/WeekStepper',
  component: WeekStepper,
  args: {
    label: '28 Sep – 4 Oct',
    sub: 'This week',
    canPrev: true,
    canNext: false,
    prevLabel: 'Previous week',
    nextLabel: 'Next week',
    onPrev: () => undefined,
    onNext: () => undefined,
    onOpen: () => undefined,
  },
} satisfies Meta<typeof WeekStepper>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Current: Story = {};
export const Older: Story = { args: { label: '21 – 27 Sep', sub: '3 sessions', canNext: true } };
export const NoPicker: Story = { args: { onOpen: undefined } };
