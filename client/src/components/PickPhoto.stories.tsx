import type { Meta, StoryObj } from '@storybook/react-vite';
import { PickPhoto } from './PickPhoto';

const meta = {
  title: 'Components/PickPhoto',
  component: PickPhoto,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="es-tile-main" style={{ width: 168 }}>
        <Story />
      </div>
    ),
  ],
  args: { kind: 'warmup', src: '/markers/warmup.jpg', fallbackClassName: 'es-noimg' },
} satisfies Meta<typeof PickPhoto>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The photo loads. */
export const Photo: Story = {};
/** No src for the type: the glyph on a tinted gradient, never an empty box. */
export const Missing: Story = { args: { src: '' } };
/** The picture URL fails (404, blocked, HTML instead of an image): the same fallback appears. */
export const Broken: Story = { args: { src: '/markers/does-not-exist.jpg' } };
export const CooldownMissing: Story = { args: { kind: 'cooldown', src: undefined } };
export const CardioMissing: Story = { args: { kind: 'cardio', src: undefined } };
export const HomeMissing: Story = { args: { kind: 'home', src: undefined } };
export const StrengthMissing: Story = { args: { kind: 'strength', src: undefined } };
