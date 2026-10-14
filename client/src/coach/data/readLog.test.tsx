import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createLocalReadLog, useReadLog } from './readLog';

afterEach(cleanup);

function Probe({
  port,
  tab,
  cats,
  skip,
}: {
  port: ReturnType<typeof createLocalReadLog>;
  tab: string;
  cats: ('totals' | 'sets')[];
  skip?: boolean;
}) {
  useReadLog(port, 'c1', tab, cats, skip);
  return null;
}

describe('read log', () => {
  it('logs each category once per tab open, not per render', () => {
    const port = createLocalReadLog();
    const { rerender } = render(<Probe port={port} tab="workouts" cats={['totals', 'sets']} />);
    rerender(<Probe port={port} tab="workouts" cats={['totals', 'sets']} />);
    rerender(<Probe port={port} tab="workouts" cats={['totals', 'sets']} />);
    expect(port.entries).toEqual([
      { clientId: 'c1', category: 'totals', via: 'view' },
      { clientId: 'c1', category: 'sets', via: 'view' },
    ]);
  });
  it('a new tab is a new read', () => {
    const port = createLocalReadLog();
    const { rerender } = render(<Probe port={port} tab="workouts" cats={['totals']} />);
    rerender(<Probe port={port} tab="strength" cats={['sets']} />);
    expect(port.entries.map((e) => e.category)).toEqual(['totals', 'sets']);
  });
  it('logs nothing when nothing was read (locked)', () => {
    const port = createLocalReadLog();
    render(<Probe port={port} tab="workouts" cats={['totals']} skip />);
    render(<Probe port={port} tab="strength" cats={[]} />);
    expect(port.entries).toEqual([]);
  });
});
