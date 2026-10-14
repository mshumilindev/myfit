import { describe, expect, it } from 'vitest';
import { planProgramId } from './program/planCodec';
import {
  clientProgramId,
  coachHash,
  isProgramPage,
  navScreenOf,
  parseCoachHash,
  programPageBack,
  programPageClient,
  programPageRoute,
  type CoachRoute,
} from './routes';

describe('program pages live under programs (#/c/programs/<programId>/edit | check)', () => {
  it('the program id is the plan program of the client (drift guard)', () => {
    expect(clientProgramId('c1')).toBe(planProgramId('c1'));
  });

  it.each(['edit', 'check'] as const)('%s round-trips through the hash', (sub) => {
    const r = programPageRoute('c1', sub, 'list');
    expect(coachHash(r)).toBe(`#/c/programs/prg-c1/${sub}`);
    expect(parseCoachHash(coachHash(r))).toEqual(r);
  });

  it('keeps the client it was opened from as context (?client=)', () => {
    const r = programPageRoute('c1', 'edit', 'client');
    expect(coachHash(r)).toBe('#/c/programs/prg-c1/edit?client=c1');
    expect(parseCoachHash(coachHash(r))).toEqual(r);
    expect(programPageClient(r)).toBe('c1');
  });

  it('Back returns to the opener: the client tab, or the Programs list', () => {
    expect(programPageBack(programPageRoute('c1', 'edit', 'client'))).toEqual({
      screen: 'client',
      cid: 'c1',
      tab: 'program',
    });
    expect(programPageBack(programPageRoute('c1', 'edit', 'list'))).toEqual({
      screen: 'programs',
    });
  });

  it('a link without a client still resolves the client from the program id', () => {
    const r = parseCoachHash('#/c/programs/prg-abc-9/edit');
    expect(isProgramPage(r) && programPageClient(r)).toBe('abc-9');
  });

  it('a bare program id opens the editor; the list route has no program', () => {
    expect(parseCoachHash('#/c/programs/prg-c1')).toMatchObject({ sub: 'edit' });
    expect(parseCoachHash('#/c/programs')).toEqual({ screen: 'programs' });
    expect(isProgramPage({ screen: 'programs' })).toBe(false);
  });

  it('old URLs land on the new ones (opened from that client)', () => {
    for (const sub of ['edit', 'check'] as const) {
      const r = parseCoachHash(`#/c/clients/c1/program/${sub}`);
      expect(r).toEqual(programPageRoute('c1', sub, 'client'));
      expect(coachHash(r)).toBe(`#/c/programs/prg-c1/${sub}?client=c1`);
    }
  });

  it('a tab route has no sub and stays the same', () => {
    const r: CoachRoute = { screen: 'client', cid: 'c1', tab: 'program' };
    expect(coachHash(r)).toBe('#/c/clients/c1/program');
    expect(parseCoachHash('#/c/clients/c1/program')).toEqual(r);
  });

  it('both pages light Programs in the navigation', () => {
    expect(navScreenOf(programPageRoute('c1', 'edit', 'client'))).toBe('programs');
  });
});
