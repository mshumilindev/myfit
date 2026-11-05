import type { Meta, StoryObj } from '@storybook/react-vite';
import { SK_ICONS, type SkIconName } from '../icons';
import { SkStage, SkStageRow } from '../stories/SkStage';
import { SkStatusHeader, type SkStatus } from './SkStatusHeader';

const Svg = ({ name }: { name: SkIconName }) => (
  <svg viewBox="0 0 24 24">
    <path d={SK_ICONS[name]} />
  </svg>
);

const ROWS: Array<[SkStatus, SkIconName, string]> = [
  ['warn', 'list', 'Ready to install'],
  ['progress', 'sync', 'Installing'],
  ['ok', 'inst', 'All set'],
  ['warn', 'alert', 'You are offline'],
  ['bad', 'alert', 'Install failed'],
];

const meta = {
  title: 'Store/SkStatusHeader',
  component: SkStatusHeader,
  args: { status: 'ok', icon: <Svg name="inst" />, title: 'All set' },
} satisfies Meta<typeof SkStatusHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <SkStage width="phone">
      <SkStatusHeader {...args} />
    </SkStage>
  ),
};

/** Boards 09 (warn), 10 (progress), 11 (ok), 15 (offline), 16 (bad). */
export const Statuses: Story = {
  render: () => (
    <SkStage width="phone">
      {ROWS.map(([s, i, t]) => (
        <SkStageRow key={t} label={s}>
          <SkStatusHeader status={s} icon={<Svg name={i} />} title={t} />
        </SkStageRow>
      ))}
    </SkStage>
  ),
};

export const WithAsideAndLongTitle: Story = {
  render: () => (
    <SkStage width="phone">
      <SkStatusHeader
        status="bad"
        icon={<Svg name="alert" />}
        title="Something went wrong while installing three add-ons"
        aside={<span>AK</span>}
      />
    </SkStage>
  ),
};

export const IconOnly: Story = {
  render: () => (
    <SkStage width="phone">
      <SkStatusHeader status="bad" icon={<Svg name="alert" />} statusLabel="Install failed" />
    </SkStage>
  ),
};
