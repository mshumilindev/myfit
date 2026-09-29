import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DragHandle } from './DragHandle';
import { LocaleMatrix, Row, Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/DragHandle',
  component: DragHandle,
  args: { label: 'Drag Nudges', pinned: false, dragging: false },
} satisfies Meta<typeof DragHandle>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Default, dragging and pinned (can't move). */
export const States: Story = {
  render: () => (
    <Row>
      <DragHandle label="Drag" />
      <DragHandle label="Drag" dragging />
      <DragHandle label="Pinned" pinned />
    </Row>
  ),
};

/** Keyboard path: focus a handle and press ↑ / ↓. */
function Reorder() {
  const [items, setItems] = useState(['Atlas & clients', 'Program & week', 'Nudges', 'History']);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  };
  return (
    <Stack width={320}>
      {items.map((x, i) => (
        <Row key={x}>
          <DragHandle label={`Drag ${x}`} onMove={(d) => move(i, d)} />
          <span>{x}</span>
        </Row>
      ))}
    </Stack>
  );
}
export const KeyboardReorder: Story = { render: () => <Reorder /> };

/** Accessible names in every locale. */
export const Locales: Story = {
  render: () => (
    <LocaleMatrix
      render={(t) => (
        <Row>
          <DragHandle label={t.todayDragSection(t.todayCore.nudges)} />
          <span>{t.todayCore.nudges}</span>
        </Row>
      )}
    />
  ),
};
