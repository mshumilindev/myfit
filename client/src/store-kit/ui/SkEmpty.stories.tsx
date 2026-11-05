import type { Meta, StoryObj } from '@storybook/react-vite';
import { SK_ICONS } from '../icons';
import { SkStage } from '../stories/SkStage';
import { SkBtn } from './SkBtn';
import { SkEmpty } from './SkEmpty';
import './SkRow.stories.css';

const meta = { title: 'Store/SkEmpty', component: SkEmpty } satisfies Meta<typeof SkEmpty>;
export default meta;
type Story = StoryObj<typeof meta>;

const Icon = ({ d }: { d: string }) => (
  <svg className="sk-demo-empty-ic" viewBox="0 0 24 24" aria-hidden="true">
    <path d={d} />
  </svg>
);

/** Boards 17 (no results), 18 (nothing installed), 32 (selected, empty). */
export const States: Story = {
  render: () => (
    <SkStage width="phone">
      <SkEmpty
        icon={<Icon d={SK_ICONS.search} />}
        title="No results for “zzz”"
        body="Check the spelling or try a different word."
      />
      <SkEmpty
        icon={<Icon d={SK_ICONS.inst} />}
        title="Nothing installed yet"
        body="Apps and add-ons you install will show up here."
        actions={
          <>
            <SkBtn kind="pri">Browse apps</SkBtn>
            <SkBtn kind="ghost">Browse add-ons</SkBtn>
          </>
        }
      />
      <SkEmpty title="Nothing selected" body="Add items from the store and they will wait here." />
    </SkStage>
  ),
};
