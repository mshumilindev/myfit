import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import './SkRow.stories.css';
import { SkStage } from '../stories/SkStage';
import { SkBtn } from './SkBtn';
import { SkRow } from './SkRow';
import { SkList } from './SkList';

/** Stand-ins for batch A slots so stories stay self-contained. */
const Tile = ({ n }: { n: number }) => (
  <span
    aria-hidden="true"
    className="sk-demo-tile"
    style={{ '--demo-bg': `var(--ic-${n})` } as CSSProperties}
  >
    {String.fromCharCode(65 + n)}
  </span>
);

const meta = { title: 'Store/SkRow', component: SkRow, args: { name: 'Name' } } satisfies Meta<
  typeof SkRow
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const States: Story = {
  render: () => (
    <SkStage width="phone">
      <SkList>
        <SkRow
          tile={<Tile n={1} />}
          name="Health"
          desc="Sleep, steps and heart rate"
          action={<SkBtn>Add</SkBtn>}
        />
        <SkRow
          tile={<Tile n={2} />}
          name="Sleep"
          desc="Nightly score"
          badge={<span className="sk-t-c">Add-on</span>}
          rel="Works with Health"
          action={<SkBtn kind="ghost">Added</SkBtn>}
          onOpen={() => undefined}
        />
        <SkRow tile={<Tile n={3} />} name="Name only" />
        <SkRow
          tile={<Tile n={4} />}
          name="A very long add-on name that has to wrap instead of overflowing the row"
          desc="A long description that also wraps onto several lines on a narrow phone screen without breaking the layout"
          rel="Works with Atlas and Health"
          action={<SkBtn size="s">Add</SkBtn>}
          noBorder
        />
      </SkList>
    </SkStage>
  ),
};
