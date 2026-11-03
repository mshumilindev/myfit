import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CallWave } from './CallWave';
import { Row } from '../../stories/LocaleMatrix';
import { talkerLevel } from '../../stories/callFixtures';

const meta = {
  title: 'Kit/CallWave',
  component: CallWave,
} satisfies Meta<typeof CallWave>;
export default meta;
type Story = StoryObj<typeof meta>;

/** No level given: the bars breathe on their own (still under reduced motion). */
export const Breathing: Story = {};
export const Inactive: Story = { args: { active: false } };

/** A fixed level, from silence to loud. */
export const Levels: Story = {
  render: () => (
    <Row gap={32}>
      {[0, 0.25, 0.6, 1].map((l) => (
        <CallWave key={l} level={l} />
      ))}
    </Row>
  ),
};

/** Bars driven by a level, here a simulated talker; in the app it is the microphone / remote stream RMS. */
export const Live: Story = {
  render: function Render() {
    const [t, setT] = useState(0);
    useEffect(() => {
      const id = setInterval(() => setT((v) => v + 1), 70);
      return () => clearInterval(id);
    }, []);
    return <CallWave level={talkerLevel(t)} phase={t / 4} />;
  },
};
