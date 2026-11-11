import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SaveGuide } from './SaveGuide';

const meta = { title: 'Kit/SaveGuide', component: SaveGuide } satisfies Meta<typeof SaveGuide>;
export default meta;
type Story = StoryObj<typeof meta>;

function Demo({ done }: { done: boolean[] }) {
  const [state, setState] = useState(done);
  const names = ['Title', 'Weekday', 'End date'];
  return (
    <div style={{ display: 'grid', gap: 12, justifyItems: 'end', paddingTop: 120 }}>
      {names.map((n, i) => (
        <label key={n}>
          <input
            type="checkbox"
            checked={state[i]}
            onChange={() => setState(state.map((v, j) => (j === i ? !v : v)))}
          />{' '}
          {n}
        </label>
      ))}
      <SaveGuide
        label="Save"
        heading="Still needed"
        items={names.map((n, i) => ({ id: n, label: n, done: state[i] }))}
        onSave={() => undefined}
      />
    </div>
  );
}

/** Press the grey Save: the flag lists what is missing. Tick everything: the dots vanish. */
export const Playground: Story = {
  args: { label: 'Save', heading: 'Still needed', items: [], onSave: () => undefined },
  render: () => <Demo done={[true, false, false]} />,
};
