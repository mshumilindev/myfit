/** SPO-307 (R15, R16): what happens when a member activates their own program. */
import { describe, expect, it } from 'vitest';
import { planActivation, type ActivationInput } from '../../functions/src/programActivation';

const base: ActivationInput = {
  uid: 'm1',
  programId: 'tl-m1-linear-5x5-ab',
  programStatus: 'draft',
  trainerId: 't1',
  assignment: null,
  assignedProgramStatus: null,
  assignerRole: null,
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
  it('a stale assignment does not lock the member out', () => {
    expect(planActivation(held({ assignedProgramStatus: null }))).toBe('apply'); // program deleted
    expect(planActivation(held({ assignedProgramStatus: 'archived' }))).toBe('apply');
    expect(planActivation(held({ assignerRole: null }))).toBe('apply'); // assigner gone
    expect(planActivation(held({ trainerId: 't2' }))).toBe('apply'); // no longer their trainer
    expect(planActivation(held({ trainerId: null }))).toBe('apply');
  });
});
