import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';
import { DataTable, type DataTableColumn } from './DataTable';
import { WidgetSpark } from './Widget';

interface Lift {
  name: string;
  target: string;
  e1rm: number;
  series: number[];
}
const lifts: Lift[] = [
  {
    name: 'Bench press',
    target: '100 kg × 5',
    e1rm: 116,
    series: [111, 113, 116, 116, 116, 115, 116, 116],
  },
  {
    name: 'Bent-over row',
    target: '70 kg × 8',
    e1rm: 89,
    series: [80, 82, 83, 85, 86, 87, 88, 89],
  },
];
const cols: DataTableColumn<Lift>[] = [
  { id: 'lift', header: 'Lift', strong: true, cell: (r) => r.name },
  { id: 'target', header: 'Target', muted: true, cell: (r) => r.target },
  { id: 'e1rm', header: 'Est. 1RM', align: 'end', strong: true, cell: (r) => `${r.e1rm} kg` },
  {
    id: 'trend',
    header: 'Trend',
    cell: (r) => (
      <span style={{ display: 'block', width: 96 }}>
        <WidgetSpark
          points={r.series}
          width={96}
          height={24}
          area
          tone={r.name === 'Bench press' ? 'danger' : 'ok'}
        />
      </span>
    ),
  },
];

const meta = {
  title: 'Coach/DataTable',
  component: DataTable<Lift>,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 640 }}>
        <Story />
      </div>
    ),
  ],
  args: { label: 'Strength lifts', columns: cols, rows: lifts, rowKey: (r: Lift) => r.name },
} satisfies Meta<typeof DataTable<Lift>>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Lifts: Story = {};
export const WithFooter: Story = {
  args: {
    footer: (
      <Button variant="link" size="sm" iconTrailing="arrow-right">
        All lifts
      </Button>
    ),
  },
};

/** Inside another card: no Card of its own, header row only for assistive tech. */
export const BareHeadless: Story = { args: { bare: true, headless: true } };
