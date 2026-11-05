import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage, SkStageRow } from '../stories/SkStage';
import { SkHeader } from './SkHeader';

const Ic = ({ d }: { d: string }) => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);
const exitIcon = <Ic d="M6 6l12 12M18 6L6 18" />;
const backIcon = <Ic d="M15 5l-7 7 7 7" />;
const avatar = (
  <button type="button" className="sk-av sk-avbtn" aria-label="Profile">
    AK
  </button>
);

const meta = {
  title: 'Store/SkHeader',
  component: SkHeader,
  args: { title: 'Discover', avatar, onExit: () => {}, exitLabel: 'Back to Spotter', exitIcon },
} satisfies Meta<typeof SkHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Title: Story = {
  render: (args) => (
    <SkStage width="phone">
      <SkHeader {...args} />
    </SkStage>
  ),
};

/** Root title, detail with back, long title (ellipsis), no avatar. */
export const Variants: Story = {
  render: (args) => (
    <SkStage width="phone">
      <SkStageRow label="back">
        <SkHeader {...args} onBack={() => {}} backLabel="Back" backIcon={backIcon} />
      </SkStageRow>
      <SkStageRow label="long title">
        <SkHeader {...args} title="A very long screen title that must not push the buttons away" />
      </SkStageRow>
      <SkStageRow label="exit only">
        <SkHeader {...args} avatar={undefined} />
      </SkStageRow>
    </SkStage>
  ),
};
