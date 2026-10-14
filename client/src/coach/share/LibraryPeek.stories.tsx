import type { Meta, StoryObj } from '@storybook/react-vite';
import { ShareStoryFrame } from './ShareStoryFrame';

/** The library peek (S-16c): drawer from 768, sheet below. One story per item type, plus locked and gone. */
const meta = {
  title: 'Pages/Coach/Library peek',
  component: ShareStoryFrame,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ShareStoryFrame>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Exercise: Story = {
  args: { initial: { peek: { kind: 'exercise', id: 'Barbell_Bench_Press_-_Medium_Grip' } } },
};
export const ExerciseLocked: Story = {
  args: {
    initial: { peek: { kind: 'exercise', id: 'Barbell_Bench_Press_-_Medium_Grip' } },
    off: ['sets'],
  },
};
export const Equipment: Story = {
  args: { initial: { peek: { kind: 'equipment', id: 'barbell-olympic' } } },
};
export const Gym: Story = { args: { initial: { peek: { kind: 'gym', id: 'iron-yard' } } } };
export const Muscle: Story = {
  args: { initial: { peek: { kind: 'muscle', id: 'chest', ownerId: 'c1' } } },
};
export const MuscleLocked: Story = {
  args: { initial: { peek: { kind: 'muscle', id: 'chest', ownerId: 'c1' } }, off: ['sets'] },
};
export const Gone: Story = {
  args: { initial: { peek: { kind: 'exercise', id: 'deleted-exercise' } } },
};
