import type { Meta, StoryObj } from '@storybook/react-vite';
import { Ring } from './Ring';
import { TONES } from './tones';
import { Row } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/Ring',
  component: Ring,
  args: { value: 82, size: 64, width: 6, tone: 'ok', children: '82%', label: 'Readiness' },
  argTypes: { tone: { control: 'select', options: TONES } },
} satisfies Meta<typeof Ring>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Every family; sizes; empty and full. */
export const Tones: Story = {
  render: () => (
    <Row>
      {TONES.map((t, i) => (
        <Ring key={t} tone={t} value={(i + 1) * 7} size={48} width={5} label={t}>
          {(i + 1) * 7}
        </Ring>
      ))}
      <Ring value={0} size={32} width={4} label="empty" />
      <Ring value={100} size={104} width={8} tone="rest" label="rest">
        1:12
      </Ring>
    </Row>
  ),
};
