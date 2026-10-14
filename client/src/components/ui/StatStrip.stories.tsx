import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatStrip } from './StatStrip';
import { LocaleMatrix } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/StatStrip',
  component: StatStrip,
  args: {
    label: 'Last 30 days',
    items: [
      { value: 22, label: 'trained' },
      { value: 6, label: 'rest', tone: 'rest' },
      { value: 1, label: 'sick', tone: 'illness' },
      { value: 4, label: 'PRs', tone: 'ok' },
      { value: '49.2', unit: 't', label: 'volume' },
    ],
  },
  decorators: [
    (S) => (
      <div style={{ width: 358 }}>
        <S />
      </div>
    ),
  ],
} satisfies Meta<typeof StatStrip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Nothing logged yet: dashes. */
export const Empty: Story = {
  args: {
    items: [
      { value: '—', label: 'trained' },
      { value: '—', label: 'rest' },
      { value: '—', label: 'sick' },
    ],
  },
};

/** Long labels in every locale (the History "Last 30 days"). */
export const Locales: Story = {
  render: () => (
    <LocaleMatrix
      render={(t) => (
        <StatStrip
          items={[
            { value: 22, label: t.histCalTrained },
            { value: 6, label: t.histCalRest, tone: 'rest' },
            { value: 1, label: t.histCalSick, tone: 'illness' },
            { value: 4, label: t.histCalPrs, tone: 'ok' },
            { value: '49.2', unit: 't', label: t.histCalVolume },
          ]}
        />
      )}
    />
  ),
};

/** `wrapLabels`: a long label wraps onto a second line instead of ending in an ellipsis (the Coach Week digest). */
export const WrapLabels: Story = {
  args: {
    wrapLabels: true,
    items: [
      { value: '3/14', label: 'Sessions done' },
      { value: 2, label: 'Waiting for an answer', tone: 'accent' },
      { value: 2, label: 'Decisions open', tone: 'accent' },
    ],
  },
};
