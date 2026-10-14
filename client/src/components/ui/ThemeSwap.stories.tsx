import { useEffect, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';
import { Card } from './Card';
import { Chip, ChipGroup } from './Chip';
import { GroupedList, ListRow } from './GroupedList';
import { IconTile } from './IconTile';
import { ScrollTabs } from './ScrollTabs';
import { Segmented } from './Segmented';
import { Tag } from './Tag';

/** The whole re-theme is a token edit at :root. These values are what `docs/THEME-SWAP.md` calls the "one pass". */
const SWAP: Record<string, string> = {
  '--r-6': '2px',
  '--r-8': '3px',
  '--r-10': '4px',
  '--r-12': '4px',
  '--r-14': '6px',
  '--r-16': '6px',
  '--r-pill': '6px',
  '--s-4': '6px',
  '--s-8': '12px',
  '--s-12': '16px',
  '--s-16': '22px',
  '--font': "Georgia, 'Times New Roman', serif",
  '--seg-bg': '#2a2118',
  '--seg-on-base': '#d9a24f',
  '--seg-on-mix': '90%',
  '--chip-bg': '#2a2118',
  '--chip-on-fg': '#ffe2a8',
};

function Swap({ children }: { children: ReactNode }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    if (on) for (const [k, v] of Object.entries(SWAP)) root.style.setProperty(k, v);
    return () => {
      for (const k of Object.keys(SWAP)) root.style.removeProperty(k);
    };
  }, [on]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 380 }}>
      <Button variant="secondary" size="sm" onClick={() => setOn((v) => !v)}>
        {on ? 'Back to Brass Glass' : 'Swap tokens at :root'}
      </Button>
      {children}
    </div>
  );
}

function Gallery() {
  const [seg, setSeg] = useState('a');
  const [tab, setTab] = useState('overview');
  const [chip, setChip] = useState('all');
  return (
    <Swap>
      <Segmented
        label="demo"
        value={seg}
        onChange={setSeg}
        options={[
          { value: 'a', label: 'By priority' },
          { value: 'b', label: 'By stage', badge: 4 },
        ]}
      />
      <Segmented
        size="sm"
        variant="buttons"
        label="demo buttons"
        value={seg}
        onChange={setSeg}
        options={[
          { value: 'a', label: '15' },
          { value: 'b', label: '30' },
          { value: 'c', label: '45' },
        ]}
      />
      <ScrollTabs
        label="demo tabs"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'workouts', label: 'Workouts' },
          { id: 'program', label: 'Program' },
        ]}
      />
      <ChipGroup role="group" aria-label="demo chips">
        {['all', 'attention', 'done'].map((c, i) => (
          <Chip key={c} selected={chip === c} count={[14, 4, 6][i]} onClick={() => setChip(c)}>
            {c}
          </Chip>
        ))}
      </ChipGroup>
      <Card pad="md" emphasis="card">
        <GroupedList>
          <ListRow
            icon={<IconTile tone="accent" size={30} icon="user" />}
            label="List row"
            sub="tile, text and spacing follow the tokens"
          />
        </GroupedList>
        <Tag tone="accent">Tag</Tag>
      </Card>
    </Swap>
  );
}

const meta = { title: 'Foundations/Theme swap', component: Gallery } satisfies Meta<typeof Gallery>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Press the button: radius scale, spacing scale, font, segment / chip surfaces all change by editing tokens at :root only. */
export const OnePass: Story = {};
