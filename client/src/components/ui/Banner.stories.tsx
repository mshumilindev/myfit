import type { Meta, StoryObj } from '@storybook/react-vite';
import { Banner, type BannerTone } from './Banner';
import { LocaleMatrix, Stack } from '../../stories/LocaleMatrix';

const TONES: BannerTone[] = ['accent', 'rest', 'danger', 'ok'];
const ICON: Record<BannerTone, string> = {
  accent: 'target',
  rest: 'moon-stars',
  danger: 'heartbeat',
  ok: 'check-circle',
};

const meta = {
  title: 'Kit/Banner',
  component: Banner,
  args: {
    tone: 'accent',
    icon: 'target',
    kicker: 'Program',
    title: 'Week 3 of 8',
    body: 'A frosted-gem banner: one tone drives glass, rim, icon and text shades.',
    primaryAction: { label: 'Start', icon: 'arrow-right', onClick: () => undefined },
    skipAction: { label: 'Skip', onClick: () => undefined },
  },
  argTypes: { tone: { control: 'select', options: TONES } },
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Banner>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Every tone. */
export const Tones: Story = {
  render: (args) => (
    <Stack>
      {TONES.map((tone) => (
        <Banner key={tone} {...args} tone={tone} icon={ICON[tone]} kicker={`${tone} banner`} />
      ))}
    </Stack>
  ),
};

/** Minimal (title only, no sheen) and a disabled primary action. */
export const Minimal: Story = {
  render: () => (
    <Stack>
      <Banner tone="rest" title="Rest day" sheen={false} />
      <Banner
        tone="ok"
        icon="check-circle"
        title="All sets logged"
        primaryAction={{ label: 'Finish', onClick: () => undefined, disabled: true }}
      />
    </Stack>
  ),
};

/** Real copy in five locales. */
export const LongText: Story = {
  render: () => (
    <LocaleMatrix
      render={(t) => (
        <Banner
          tone="rest"
          icon="moon-stars"
          title={t.hlWelcomeBack}
          body={t.hlTakeEasy}
          primaryAction={{ label: t.hlSeeAll, onClick: () => undefined }}
        />
      )}
    />
  ),
};
