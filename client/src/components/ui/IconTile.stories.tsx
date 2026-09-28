import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconTile } from './IconTile';
import { TONES } from './tones';
import { Row, Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/IconTile',
  component: IconTile,
  args: { tone: 'accent', size: 36, icon: 'person-simple-run' },
  argTypes: {
    tone: { control: 'select', options: TONES },
    size: { control: 'select', options: [22, 30, 32, 34, 36, 40, 44, 48, 56] },
  },
} satisfies Meta<typeof IconTile>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Every colour family. */
export const Tones: Story = {
  render: () => (
    <Row>
      {TONES.map((tone) => (
        <div key={tone} style={{ display: 'grid', justifyItems: 'center', gap: 6 }}>
          <IconTile tone={tone} size={44} icon="heartbeat" />
          <span style={{ font: '500 11px var(--font)', color: 'var(--color-text-muted)' }}>
            {tone}
          </span>
        </div>
      ))}
    </Row>
  ),
};

/** Sizes 22 → 56 (radius and glyph scale). */
export const Sizes: Story = {
  render: () => (
    <Row>
      {([22, 30, 32, 34, 36, 40, 44, 48, 56] as const).map((s) => (
        <IconTile key={s} tone="sport" size={s} icon="tennis-ball" />
      ))}
    </Row>
  ),
};

/** Outline (placeholder / add) and a custom SVG glyph. */
export const OutlineAndCustomGlyph: Story = {
  render: () => (
    <Stack>
      <Row>
        <IconTile outline size={36} icon="plus" />
        <IconTile outline size={48} icon="hand-tap" />
      </Row>
      <IconTile tone="illness" size={30}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z" />
        </svg>
      </IconTile>
    </Stack>
  ),
};
