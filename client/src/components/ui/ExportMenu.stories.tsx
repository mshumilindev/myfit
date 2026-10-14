import type { Meta, StoryObj } from '@storybook/react-vite';
import { ExportMenu, type ExportMenuStrings } from './ExportMenu';

const P = (n: number) => `${n} ${n === 1 ? 'row' : 'rows'}`;
export const EXPORT_STRINGS: ExportMenuStrings = {
  button: 'Export',
  title: 'Export session history',
  asShown: (n) => `${P(n)}, as shown now.`,
  view: 'Current view',
  viewHint: (n) => `${P(n)}, filters and sort applied`,
  all: 'All rows',
  allHint: (n) => `${P(n)}, ignores filters`,
  group: 'Rows to export',
  cols: (n, list) => `${n} columns: ${list}`,
  leftOut: (list) => `Left out, not shared with you: ${list}.`,
  leftOutNone: 'Data a client has not shared with you is left out.',
  cancel: 'Cancel',
  submit: 'Export CSV',
  empty: 'Nothing to export yet.',
};

/** Coach kit: export button with a popover (desktop) or bottom sheet (phone). */
const meta = {
  title: 'Coach/Export menu',
  component: ExportMenu,
  parameters: { layout: 'padded' },
  args: {
    strings: EXPORT_STRINGS,
    rows: 41,
    columns: ['Date', 'Session', 'Duration (min)', 'Sets', 'Tonnage (kg)', 'PR', 'Adherence (%)'],
    onExport: () => 'Exported sessions-oleh.csv, 41 rows',
  },
  decorators: [
    (S) => (
      <div style={{ minHeight: 420, display: 'flex', justifyContent: 'flex-end' }}>
        <S />
      </div>
    ),
  ],
} satisfies Meta<typeof ExportMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};
export const Open: Story = { args: { defaultOpen: true } };
/** workouts-totals-only: sets, tonnage, PR and adherence are left out and named. */
export const LeftOut: Story = {
  args: {
    defaultOpen: true,
    columns: ['Date', 'Session', 'Duration (min)'],
    omitted: ['Sets', 'Tonnage (kg)', 'PR', 'Adherence (%)'],
  },
};
/** Filters active: the choice between the current view and all rows. */
export const CurrentViewOrAll: Story = { args: { defaultOpen: true, rows: 12, allRows: 42 } };
export const Empty: Story = { args: { defaultOpen: true, rows: 0 } };
