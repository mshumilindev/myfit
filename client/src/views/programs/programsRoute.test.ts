import { describe, expect, it } from 'vitest';
import {
  PROGRAM_NEW_HASH,
  isProgramsEditorHash,
  parseProgramsHash,
  programEditHash,
  programsHash,
} from './programsRoute';

describe('athlete program editor routes (#/programs/<id>/edit | #/programs/new)', () => {
  it('round-trips an id, encoding it', () => {
    expect(programEditHash('p 1/2')).toBe('#/programs/p%201%2F2/edit');
    expect(parseProgramsHash(programEditHash('p 1/2'))).toEqual({ kind: 'edit', id: 'p 1/2' });
  });
  it('new', () => {
    expect(parseProgramsHash(PROGRAM_NEW_HASH)).toEqual({ kind: 'new' });
    expect(parseProgramsHash('#/programs/new/edit')).toEqual({ kind: 'new' });
    expect(programsHash({ kind: 'new' })).toBe(PROGRAM_NEW_HASH);
  });
  it('an id without /edit opens the editor too; the list and other tabs do not', () => {
    expect(parseProgramsHash('#/programs/abc')).toEqual({ kind: 'edit', id: 'abc' });
    expect(programsHash(parseProgramsHash('#/programs/abc'))).toBe('#/programs/abc/edit');
    expect(parseProgramsHash('#/programs')).toBeNull();
    expect(parseProgramsHash('#/progress/volume')).toBeNull();
    expect(isProgramsEditorHash('#/programs/abc/edit?x=1')).toBe(true);
    expect(programsHash(null)).toBe('#/programs');
  });
  it('a bad escape does not throw', () => {
    expect(parseProgramsHash('#/programs/%E0%A4%A/edit')).toEqual({ kind: 'edit', id: '%E0%A4%A' });
  });
});
