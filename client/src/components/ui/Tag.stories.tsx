import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tag } from './Tag';
import { TONES } from './tones';
import { Row, Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/Tag',
  component: Tag,
  args: { children: 'PR', tone: 'accent' },
  argTypes: { tone: { control: 'select', options: TONES } },
} satisfies Meta<typeof Tag>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Every family, tint and solid. */
export const Tones: Story = {
  render: () => (
    <Stack>
      <Row>
        {TONES.map((t) => (
          <Tag key={t} tone={t}>
            {t}
          </Tag>
        ))}
      </Row>
      <Row>
        {TONES.map((t) => (
          <Tag key={t} tone={t} solid>
            {t}
          </Tag>
        ))}
      </Row>
      <Row>
        <Tag>PR</Tag>
        <Tag tone="injury">F</Tag>
        <Tag tone="apex">drop</Tag>
        <Tag tone="rest">warm-up</Tag>
        <Tag tone="neutral">auto</Tag>
        <Tag tone="ok">+2.5 kg</Tag>
      </Row>
    </Stack>
  ),
};
