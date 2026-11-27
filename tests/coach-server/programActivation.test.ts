/** SPO-307 (R15, R16): what happens when a member activates their own program. */
import { describe, expect, it } from 'vitest';
import {
  planActivation,
  replacesOwnCatalogAssignment,
  type ActivationInput,
} from '../../functions/src/programActivation';

const base: ActivationInput = {
  uid: 'm1',
  programId: 'tl-m1-linear-5x5-ab',
  programStatus: 'draft',
  trainerId: 't1',
  assignment: null,
  assignedProgramStatus: null,
  assignerRole: null,
  protectTrainer: true,
};
const held = (o: Partial<ActivationInput> = {}): ActivationInput => ({
  ...base,
  assignment: { programId: 'prg-x', assignedBy: 't1' },
  assignedProgramStatus: 'active',
  assignerRole: 'trainer',
  ...o,
});

describe('planActivation', () => {
  it('a fresh start applies', () => {
    expect(planActivation(base)).toBe('apply');
  });
  it('a repeated start of the active program writes nothing (progress is kept)', () => {
    expect(
      planActivation({
        ...base,
        programStatus: 'active',
        assignment: { programId: base.programId, assignedBy: 'm1' },
        assignedProgramStatus: 'active',
        assignerRole: 'member',
      }),
    ).toBe('noop');
  });
  it('re-activating an archived own program applies', () => {
    expect(
      planActivation({
        ...base,
        programStatus: 'archived',
        assignment: { programId: base.programId, assignedBy: 'm1' },
      }),
    ).toBe('apply');
  });
  it("the member's own earlier program is replaced, not blocked", () => {
    expect(
      planActivation({
        ...base,
        assignment: { programId: 'prg-old', assignedBy: 'm1' },
        assignedProgramStatus: 'active',
        assignerRole: 'member',
      }),
    ).toBe('apply');
  });
  it("an active trainer's program is never replaced", () => {
    expect(planActivation(held())).toBe('blocked');
    expect(planActivation(held({ assignerRole: 'admin', trainerId: null }))).toBe('blocked');
  });
  it('an ordinary (non-catalog) program keeps the old behaviour: replaces the trainer assignment', () => {
    expect(planActivation(held({ protectTrainer: false }))).toBe('apply');
  });
  it('an active program without an assignment is applied, not a false noop', () => {
    expect(planActivation({ ...base, programStatus: 'active' })).toBe('apply');
    expect(
      planActivation({
        ...base,
        programStatus: 'active',
        assignment: { programId: 'prg-x', assignedBy: 'm1' },
      }),
    ).toBe('apply');
  });
  it('a stale assignment does not lock the member out', () => {
    expect(planActivation(held({ assignedProgramStatus: null }))).toBe('apply'); // program deleted
    expect(planActivation(held({ assignedProgramStatus: 'archived' }))).toBe('apply');
    expect(planActivation(held({ assignerRole: null }))).toBe('apply'); // assigner gone
    expect(planActivation(held({ trainerId: 't2' }))).toBe('apply'); // no longer their trainer
    expect(planActivation(held({ trainerId: null }))).toBe('apply');
  });
});

describe('replacesOwnCatalogAssignment', () => {
  const own = { programId: 'tl-u-x', assignedBy: 'u' };
  it('own catalog start + an ordinary program: replaces', () => {
    expect(replacesOwnCatalogAssignment(own, 'u', 'prg-1')).toBe(true);
  });
  it("no assignment, someone else's assignment, an ordinary assignment, the same or another catalog program: leaves it", () => {
    expect(replacesOwnCatalogAssignment(null, 'u', 'prg-1')).toBe(false);
    expect(replacesOwnCatalogAssignment({ ...own, assignedBy: 't' }, 'u', 'prg-1')).toBe(false);
    expect(
      replacesOwnCatalogAssignment({ programId: 'prg-a', assignedBy: 'u' }, 'u', 'prg-1'),
    ).toBe(false);
    expect(replacesOwnCatalogAssignment(own, 'u', 'tl-u-x')).toBe(false);
    expect(replacesOwnCatalogAssignment(own, 'u', 'tl-u-y')).toBe(false);
  });
});
