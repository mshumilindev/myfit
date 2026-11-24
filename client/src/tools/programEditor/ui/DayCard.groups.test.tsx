import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setViewport } from '../../../coach/testViewport';
import { pgEn } from '../../../i18n/coachProgram.en';
import type { ProgramDoc } from '../model/doc';
import { demoDoc, demoHost } from '../stories/demoHost';
import { ProgramEditor } from './ProgramEditor';

/** Pairs are drawn where they can be used: a coach sees a client's pairs (marked as an add-on's), a person without Supersets does not. */
function paired(): ProgramDoc {
  const d = demoDoc();
  let n = 0;
  return {
    ...d,
    items: d.items.map((it) =>
      it.day === 1 && n++ < 2 ? { ...it, groupId: 'g1', groupOrder: n - 1 } : it,
    ),
  };
}

beforeEach(() => setViewport(1440));
afterEach(cleanup);

const show = (mode: 'coach' | 'self', supersets: boolean) =>
  render(
    <ProgramEditor
      host={demoHost({ mode, features: { supersets } })}
      doc={paired()}
      onChange={() => {}}
    />,
  );

describe('program editor: supersets in the day card', () => {
  it('coach: pair letters and the add-on mark', () => {
    show('coach', true);
    expect(screen.getAllByText('A1').length).toBeGreaterThan(0);
    expect(screen.getAllByText(new RegExp(pgEn.edAddonMark)).length).toBe(2);
  });
  it('self without Supersets: no letters, no mark', () => {
    show('self', false);
    expect(screen.queryByText('A1')).toBeNull();
    expect(screen.queryByText(new RegExp(pgEn.edAddonMark))).toBeNull();
  });
  it('self with Supersets: letters, no mark (it is the person own tool)', () => {
    show('self', true);
    expect(screen.getAllByText('A1').length).toBeGreaterThan(0);
    expect(screen.queryByText(new RegExp(pgEn.edAddonMark))).toBeNull();
  });
});
