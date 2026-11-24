import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setViewport } from '../../../coach/testViewport';
import { demoDoc, demoHost } from '../stories/demoHost';
import type { WrapProps } from '../host';
import { ProgramEditor } from './WrappedEditor';

beforeEach(() => setViewport(1440));
afterEach(cleanup);

describe('the editor with and without a host wrapper', () => {
  it('without a wrap slot it is the plain editor of the document', async () => {
    render(<ProgramEditor host={demoHost()} doc={demoDoc()} onChange={() => undefined} />);
    expect(await screen.findByText('Barbell Bench Press')).toBeTruthy();
  });

  it('a wrap slot decides which document the editor shows and receives its edits', async () => {
    const seen: string[] = [];
    const Wrap = ({ doc, children }: WrapProps) => {
      seen.push('wrapped');
      // another view of the same document: only the rows of day 1 and a marker in the day names
      return children({ ...doc, items: doc.items.filter((i) => i.day === 1) }, () => undefined);
    };
    const host = demoHost();
    host.slots = { ...host.slots, wrap: Wrap };
    const full = demoDoc();
    render(<ProgramEditor host={host} doc={full} onChange={() => undefined} />);
    expect(await screen.findByText('Barbell Bench Press')).toBeTruthy();
    expect(seen.length).toBeGreaterThan(0);
    const otherDayRow = full.items.find((i) => i.day !== 1 && i.kind === 'strength')!;
    expect(screen.queryByText(otherDayRow.name)).toBeNull();
  });
});
