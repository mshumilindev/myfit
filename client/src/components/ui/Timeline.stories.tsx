import type { Meta, StoryObj } from '@storybook/react-vite';
import { Timeline, TimelineDate, type TimelineRowSpec } from './Timeline';
import { ToneText } from './ToneText';

const rows: TimelineRowSpec[] = [
  {
    key: 'later',
    date: <TimelineDate day={4} weekday="Sun" startDay={28} startWeekday="Mon" />,
    rail: 'dashed',
    bars: [{ tone: 'rest', lane: 'single', faded: true }],
    label: 'Vacation',
    sub: <ToneText tone="rest">Full rest · 7 days</ToneText>,
    value: '28 Sep – 4 Oct',
  },
  {
    key: 'now',
    date: <TimelineDate text="Now" emphasis />,
    rail: 'now',
    bars: [
      { tone: 'illness', lane: 0, top: 'mid', bottom: 'edge' },
      { tone: 'injury', lane: 1, top: 'mid', bottom: 'edge' },
    ],
    label: 'Sat 26 Sep',
    strong: true,
    value: '2 active',
  },
  {
    key: 'ill',
    date: <TimelineDate day={24} weekday="Thu" />,
    bars: [
      { tone: 'injury', lane: 1, top: 'edge', bottom: 'edge' },
      { tone: 'illness', lane: 0, top: 'edge', bottom: 'inset' },
    ],
    label: 'Unwell',
    sub: <ToneText tone="illness">Day 3 · no end date</ToneText>,
    value: '24 Sep →',
  },
  {
    key: 'knee',
    date: <TimelineDate day={20} weekday="Sun" />,
    bars: [{ tone: 'injury', lane: 1, top: 'edge', bottom: 'inset' }],
    label: 'Left knee',
    sub: <ToneText tone="injury">Rehab · Reintroduce</ToneText>,
    value: '20 Sep →',
  },
  { key: 'gap', kind: 'gap', date: <TimelineDate text="19 Sep" />, label: 'Free day' },
  {
    key: 'flu',
    date: <TimelineDate day={18} weekday="Fri" startDay={12} startWeekday="Sat" />,
    bars: [{ tone: 'illness', lane: 'single' }],
    label: 'Flu',
    sub: (
      <>
        <ToneText tone="illness">Unwell · 7 days</ToneText> · workout kept 14 Sep
      </>
    ),
    value: '12–18 Sep',
  },
  { key: 'aug', kind: 'month', label: 'August' },
  {
    key: 'act',
    date: <TimelineDate day={4} weekday="Tue" startDay={2} startWeekday="Sun" />,
    bars: [{ tone: 'active', lane: 'single' }],
    label: 'Deload',
    sub: <ToneText tone="active">Active recovery · 3 days</ToneText>,
    value: '2–4 Aug',
  },
  {
    key: 'origin',
    kind: 'gap',
    date: <TimelineDate text="Jul" />,
    rail: 'origin',
    label: 'Start of your log · 1 Jul 2026',
  },
];

const meta = {
  title: 'Kit/Timeline',
  component: Timeline,
  args: { rows, label: 'Timeline' },
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Timeline>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Later (dashed, faded), Now with two lanes, overlapping periods, gaps, month rows, origin. */
export const Full: Story = {};

/** Nothing planned, nothing active. */
export const Empty: Story = {
  args: {
    rows: [
      {
        key: 'l',
        kind: 'gap',
        date: <TimelineDate text="Later" />,
        rail: 'dashed',
        label: 'Nothing planned',
      },
      {
        key: 'n',
        date: <TimelineDate text="Now" emphasis />,
        rail: 'now',
        label: 'Sat 26 Sep',
        strong: true,
      },
      {
        key: 'o',
        kind: 'gap',
        date: <TimelineDate text="Sep" />,
        rail: 'origin',
        label: 'Start of your log',
      },
    ],
  },
};

/** Web width. */
export const Wide: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 440 }}>
        <Story />
      </div>
    ),
  ],
};
