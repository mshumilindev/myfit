import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SaveGuide, useSaveGuide } from './SaveGuide';

const meta = { title: 'Kit/SaveGuide', component: SaveGuide } satisfies Meta<typeof SaveGuide>;
export default meta;
type Story = StoryObj<typeof meta>;

function Demo({ done }: { done: boolean[] }) {
  const [state, setState] = useState(done);
  const names = ['Title', 'Weekday', 'End date'];
  const guide = useSaveGuide(names.map((n, i) => ({ id: n, label: n, done: state[i] })));
  return (
    <div style={{ display: 'grid', gap: 12, justifyItems: 'end', paddingTop: 120 }}>
      {names.map((n, i) => (
        <label key={n} {...guide.field(n)} style={{ padding: 10, borderRadius: 12 }}>
          <input
            type="checkbox"
            checked={state[i]}
            onChange={() => setState(state.map((v, j) => (j === i ? !v : v)))}
          />{' '}
          {n}
        </label>
      ))}
      <SaveGuide guide={guide} label="Save" heading="Still needed" onSave={() => undefined} />
    </div>
  );
}

/** Press the grey Save: the flag lists what is missing. Tick everything: Save turns on. */
export const Playground: Story = {
  args: {
    guide: undefined as never,
    label: 'Save',
    heading: 'Still needed',
    onSave: () => undefined,
  },
  render: () => <Demo done={[true, false, false]} />,
};
