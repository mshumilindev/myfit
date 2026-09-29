import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  StoryBubble,
  StoryDivider,
  StoryRow,
  STORY_FACE_PX,
  type StoryRing,
  type StorySize,
} from './StoryBubble';
import { LocaleMatrix, Row, Stack } from '../../stories/LocaleMatrix';

const RINGS: StoryRing[] = ['default', 'new', 'live', 'alert', 'atlas'];
const SIZES: StorySize[] = ['lg', 'md', 'sm', 'xs'];

/** A stand-in portrait (Atlas's face is an image in the app). */
const portrait = (size: StorySize) => (
  <span
    style={{
      width: STORY_FACE_PX[size],
      height: STORY_FACE_PX[size],
      borderRadius: 'var(--radius-pill)',
      background: 'var(--color-atlas-tint)',
    }}
  />
);

const meta = {
  title: 'Kit/StoryBubble',
  component: StoryBubble,
  args: { label: 'Valeriia', initial: 'V', size: 'lg', ring: 'default' },
  argTypes: {
    ring: { control: 'select', options: RINGS },
    size: { control: 'select', options: SIZES },
  },
} satisfies Meta<typeof StoryBubble>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Every ring state: nothing new, new (brass), training now (green dot),
 *  alert (red + "!"), Atlas (coral + unread count). */
export const Rings: Story = {
  render: () => (
    <Row gap={14}>
      <StoryBubble label="Oleh" initial="O" ring="default" />
      <StoryBubble label="Kate" initial="K" ring="new" />
      <StoryBubble label="Valeriia" initial="V" ring="live" />
      <StoryBubble label="Konrad" initial="K" ring="alert" badge="!" />
      <StoryBubble label="Atlas" ring="atlas" media={portrait('lg')} badge={2} />
    </Row>
  ),
};

/** The four sizes (62 / 50 / 40 / 34) with every ring. */
export const Sizes: Story = {
  render: () => (
    <Stack>
      {SIZES.map((s) => (
        <Row key={s} gap={14}>
          {RINGS.map((r) => (
            <StoryBubble
              key={r}
              size={s}
              ring={r}
              label={r}
              initial="M"
              badge={r === 'alert' ? '!' : r === 'atlas' ? 3 : undefined}
            />
          ))}
          <StoryBubble size={s} more={7} label="More" />
        </Row>
      ))}
    </Stack>
  ),
};

/** Badges: none, 1, 12 (→ 9+), "!"; the "+N more" bubble. */
export const BadgesAndMore: Story = {
  render: () => (
    <Row gap={14}>
      <StoryBubble label="None" ring="atlas" media={portrait('lg')} />
      <StoryBubble label="One" ring="atlas" media={portrait('lg')} badge={1} />
      <StoryBubble label="Many" ring="atlas" media={portrait('lg')} badge={12} />
      <StoryBubble label="Alert" ring="alert" initial="K" badge="!" />
      <StoryBubble label="More" more={7} onClick={() => undefined} />
    </Row>
  ),
};

/** Interactive (button) vs static, and a long name. */
export const InteractiveAndLongText: Story = {
  render: () => (
    <Row gap={14}>
      <StoryBubble label="Tap me" initial="T" ring="new" onClick={() => undefined} />
      <StoryBubble label="Static" initial="S" />
      <StoryBubble label="Maksymiliana-Aleksandra" initial="M" ring="live" />
      <StoryBubble initial="N" aria-label="No label (bare)" />
      <StoryBubble size="sm" ring="atlas" media={portrait('sm')} aria-label="Bare Atlas" />
    </Row>
  ),
};

/** The Today strip: Atlas, a divider, then clients, then "+N". Scrolls. */
export const Strip: Story = {
  render: () => (
    <div style={{ width: 358 }}>
      <StoryRow>
        <StoryBubble label="Atlas" ring="atlas" media={portrait('lg')} badge={2} />
        <StoryDivider />
        <StoryBubble label="Valeriia" initial="V" ring="live" />
        <StoryBubble label="Kate" initial="K" ring="new" />
        <StoryBubble label="Konrad" initial="K" ring="alert" badge="!" />
        <StoryBubble label="Oleh" initial="O" />
        <StoryBubble label="Marta" initial="M" ring="new" />
        <StoryBubble more={7} label="More" />
      </StoryRow>
    </div>
  ),
};

/** Real labels in the five locales. */
export const Locales: Story = {
  render: () => (
    <LocaleMatrix
      render={(t) => (
        <StoryRow>
          <StoryBubble label={t.atlasName} ring="atlas" media={portrait('lg')} badge={2} />
          <StoryDivider />
          <StoryBubble label="Valeriia" initial="V" ring="live" />
          <StoryBubble more={7} label={t.todayMore} />
        </StoryRow>
      )}
    />
  ),
};
