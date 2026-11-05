import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage, SkStageRow } from '../stories/SkStage';
import { SkBtn, type SkBtnKind } from './SkBtn';

const KINDS: SkBtnKind[] = ['pri', 'tint', 'ghost', 'dash', 'bad', 'inv', 'ok'];

const meta = {
  title: 'Store/SkBtn',
  component: SkBtn,
  args: { children: 'Add', kind: 'tint' },
  argTypes: {
    kind: { control: 'select', options: KINDS },
    size: { control: 'select', options: [undefined, 's', 'l'] },
  },
} satisfies Meta<typeof SkBtn>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <SkStage>
      <SkBtn {...args} />
    </SkStage>
  ),
};

/** Every kind × size, light and dark; long text must not break the pill. */
export const Matrix: Story = {
  render: () => (
    <SkStage>
      {KINDS.map((k) => (
        <SkStageRow key={k} label={k}>
          <SkBtn kind={k}>Add</SkBtn>
          <SkBtn kind={k} size="s">
            Add
          </SkBtn>
          <SkBtn kind={k} disabled>
            Disabled
          </SkBtn>
          <SkBtn kind={k}>Add with Health</SkBtn>
        </SkStageRow>
      ))}
    </SkStage>
  ),
};

export const Large: Story = {
  render: () => (
    <SkStage width="phone">
      <SkBtn kind="pri" size="l">
        Install 3 items
      </SkBtn>
    </SkStage>
  ),
};
