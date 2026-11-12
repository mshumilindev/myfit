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
  const field = (n: string) => {
    const f = guide.field(n);
    return { ...f, className: `${f.className} uisg-demo` };
  };
  return (
    <div style={{ display: 'grid', gap: 12, justifyItems: 'end', paddingTop: 120 }}>
      {names.map((n, i) => (
        <label key={n} {...field(n)}>
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
