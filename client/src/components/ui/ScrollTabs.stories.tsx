import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ScrollTabs, tabIds } from './ScrollTabs';

const TABS = ['Overview', 'Workouts', 'Strength', 'Program', 'Decisions', 'Notes'].map((l) => ({
  id: l.toLowerCase(),
  label: l,
}));

const meta = {
  title: 'Coach/Scroll tabs',
  component: ScrollTabs,
  parameters: { layout: 'padded' },
  args: { tabs: TABS, value: 'overview', label: 'Client sections', onChange: () => undefined },
  render: function Render(args) {
    const [v, setV] = useState(args.value);
    return (
      <>
        <ScrollTabs {...args} idBase="demo" value={v} onChange={setV} />
        <div role="tabpanel" id={tabIds('demo', v).panel} aria-labelledby={tabIds('demo', v).tab}>
          {TABS.find((x) => x.id === v)?.label}
        </div>
      </>
    );
  },
} satisfies Meta<typeof ScrollTabs>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Wide: every tab fits. */
export const Wide: Story = {};

/** 390 wide: the row scrolls, edges fade where more tabs hide, the next tab peeks out. */
export const Phone: Story = {
  decorators: [
    (S) => (
      <div style={{ width: 358 }}>
        <S />
      </div>
    ),
  ],
};

export const LastSelected: Story = {
  args: { value: 'notes' },
  decorators: [
    (S) => (
      <div style={{ width: 358 }}>
        <S />
      </div>
    ),
  ],
};
